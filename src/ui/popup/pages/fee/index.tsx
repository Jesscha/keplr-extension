import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo
} from "react";

import { HeaderLayout } from "../../layouts/header-layout";

import { FeeButtons, GasInput, MemoInput } from "../../../components/form";
import { Button } from "reactstrap";

import { useTxBuilderConfig } from "../../../hooks";
import { TxBuilderConfig } from "@chainapsis/cosmosjs/core/txBuilder";

import bigInteger from "big-integer";
import queryString from "query-string";
import { observer } from "mobx-react";
import { useStore } from "../../stores";

import style from "./style.module.scss";

import {
  disableScroll,
  enableScroll,
  fitWindow
} from "../../../../common/window";

import { FormattedMessage, useIntl } from "react-intl";
import { useTxState, withTxStateProvider } from "../../../contexts/tx";
import { Int } from "@chainapsis/cosmosjs/common/int";
import { useHistory, useLocation, useRouteMatch } from "react-router";

export const FeePage: FunctionComponent = withTxStateProvider(
  observer(() => {
    const history = useHistory();
    const location = useLocation();
    const match = useRouteMatch<{
      id: string;
    }>();

    const query = queryString.parse(location.search);
    const external = query.external ?? false;

    const intl = useIntl();

    useEffect(() => {
      if (external) {
        fitWindow();
        disableScroll();
      } else {
        enableScroll();
      }
    }, [external]);

    const id = match.params.id;

    const { chainStore } = useStore();
    const txState = useTxState();

    const memorizedFeeCurrencies = useMemo(
      () => chainStore.chainInfo.feeCurrencies,
      [chainStore.chainInfo.feeCurrencies]
    );

    useEffect(() => {
      txState.setFeeCurrencies(memorizedFeeCurrencies);
    }, [memorizedFeeCurrencies, txState]);

    const onConfigInit = useCallback(
      (chainId: string, config: TxBuilderConfig) => {
        chainStore.setChain(chainId);

        txState.setGas(parseInt(new Int(config.gas).toString()));

        // Always returns the fee by fee buttons.
        /*if (config.fee instanceof Coin) {
          txState.setFees([config.fee])
        }*/
        // TODO: handle multiple fees.

        txState.setMemo(config.memo);
      },
      [chainStore, txState]
    );

    const onApprove = useCallback(() => {
      if (external) {
        // Wallet provider will replace window with signing page, so we don't have to close this page.
        // noop
      }
    }, [external]);

    const txBuilder = useTxBuilderConfig(id, onConfigInit, onApprove);

    useEffect(() => {
      return () => {
        // If requested id is changed, just reject the prior one.
        if (external && txBuilder.reject) {
          txBuilder.reject();
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [txBuilder.reject, id, external]);

    useEffect(() => {
      // Force reject when closing window.
      const beforeunload = async () => {
        if (!txBuilder.loading && external && txBuilder.reject) {
          await txBuilder.reject();
        }
      };

      addEventListener("beforeunload", beforeunload);
      return () => {
        removeEventListener("beforeunload", beforeunload);
      };
    }, [txBuilder, external]);

    // Cyber chain (eular-6) doesn't require the fees to send tx.
    // So, don't need to show the fee input.
    // This is temporary hardcoding.
    const isCyberNetwork = /^(euler-)(\d)+/.test(chainStore.chainInfo.chainId);
    const txStateIsValid = isCyberNetwork
      ? txState.isValid("gas", "memo")
      : txState.isValid("gas", "memo", "fees");

    return (
      <HeaderLayout
        showChainName
        canChangeChainInfo={false}
        onBackButton={
          !external
            ? () => {
                history.goBack();
              }
            : undefined
        }
      >
        <form
          className={style.formContainer}
          onSubmit={useCallback(
            e => {
              if (txStateIsValid) {
                e.preventDefault();

                if (!txBuilder.approve) {
                  throw new Error("tx builder is not loaded");
                }

                const config = txBuilder.config;
                if (!config) {
                  throw new Error("config is not loaded");
                }
                config.gas = bigInteger(txState.gas);
                config.fee = txState.fees;
                config.memo = txState.memo;
                txBuilder.approve(config);
              }
            },
            [txBuilder, txState.fees, txState.gas, txState.memo, txStateIsValid]
          )}
        >
          <div className={style.formInnerContainer}>
            <div>
              <GasInput label={intl.formatMessage({ id: "fee.input.gas" })} />
              <MemoInput label={intl.formatMessage({ id: "fee.input.memo" })} />
              {isCyberNetwork ? null : (
                <FeeButtons
                  label={intl.formatMessage({
                    id: "fee.input.fee"
                  })}
                  feeSelectLabels={{
                    low: intl.formatMessage({ id: "fee-buttons.select.low" }),
                    average: intl.formatMessage({
                      id: "fee-buttons.select.average"
                    }),
                    high: intl.formatMessage({ id: "fee-buttons.select.high" })
                  }}
                />
              )}
            </div>
            <div style={{ flex: 1 }} />
            <Button
              type="submit"
              color="primary"
              block
              disabled={txBuilder.initializing || !txStateIsValid}
              data-loading={txBuilder.requested}
            >
              <FormattedMessage id="fee.button.set" />
            </Button>
          </div>
        </form>
      </HeaderLayout>
    );
  })
);
