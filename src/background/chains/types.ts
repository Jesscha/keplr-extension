import { BIP44 } from "@chainapsis/cosmosjs/core/bip44";
import { Bech32Config } from "@chainapsis/cosmosjs/core/bech32Config";

import { AxiosRequestConfig } from "axios";
import {
  AppCurrency,
  Currency,
  CW20Currency,
  Secret20Currency
} from "../../common/currency";

import Joi, { ObjectSchema } from "joi";

export interface ChainInfo {
  readonly rpc: string;
  readonly rpcConfig?: AxiosRequestConfig;
  readonly rest: string;
  readonly restConfig?: AxiosRequestConfig;
  readonly chainId: string;
  readonly chainName: string;
  /**
   * This indicates the type of coin that can be used for stake.
   * You can get actual currency information from Currencies.
   */
  readonly stakeCurrency: Currency;
  readonly walletUrl?: string;
  readonly walletUrlForStaking?: string;
  readonly bip44: BIP44;
  readonly alternativeBIP44s?: BIP44[];
  readonly bech32Config: Bech32Config;

  readonly currencies: AppCurrency[];
  /**
   * This indicates which coin or token can be used for fee to send transaction.
   * You can get actual currency information from Currencies.
   */
  readonly feeCurrencies: Currency[];
  /**
   * This is the coin type in slip-044.
   * This is used for fetching address from ENS if this field is set.
   */
  readonly coinType?: number;

  /**
   * This is used to set the fee of the transaction.
   * If this field is empty, it just use the default gas price step (low: 0.01, average: 0.025, high: 0.04).
   * And, set field's type as primitive number because it is hard to restore the prototype after deserialzing if field's type is `Dec`.
   */
  readonly gasPriceStep?: {
    low: number;
    average: number;
    high: number;
  };

  /**
   * Indicate the features supported by this chain. Ex) cosmwasm, secretwasm ...
   */
  readonly features?: string[];

  /**
   * Shows whether the blockchain is in production phase or beta phase.
   * Major features such as staking and sending are supported on staging blockchains, but without guarantee.
   * If the blockchain is in an early stage, please set it as beta.
   */
  readonly beta?: boolean;
}

export interface AccessOrigin {
  chainId: string;
  origins: string[];
}

export type ChainInfoWithEmbed = ChainInfo & {
  embeded: boolean;
};

export type SuggestingChainInfo = Omit<ChainInfo, "bip44"> & {
  bip44: {
    coinType: number;
  };
};

export type SuggestedChainInfo = ChainInfo & {
  origin: string;
};

export const CurrencySchema = Joi.object<Currency>({
  coinDenom: Joi.string().required(),
  coinMinimalDenom: Joi.string().required(),
  coinDecimals: Joi.number()
    .integer()
    .min(0)
    .max(18)
    .required(),
  coinGeckoId: Joi.string()
});

export const CW20CurrencyShema = (CurrencySchema as ObjectSchema<CW20Currency>)
  .keys({
    type: Joi.string()
      .equal("cw20")
      .required(),
    contractAddress: Joi.string().required()
  })
  .custom((value: CW20Currency) => {
    if (
      value.coinMinimalDenom.startsWith(
        `${value.type}:${value.contractAddress}:`
      )
    ) {
      return value;
    } else {
      value.coinMinimalDenom =
        `${value.type}:${value.contractAddress}:` + value.coinMinimalDenom;
      return value;
    }
  });

export const Secret20CurrencyShema = (CurrencySchema as ObjectSchema<
  Secret20Currency
>)
  .keys({
    type: Joi.string()
      .equal("secret20")
      .required(),
    contractAddress: Joi.string().required(),
    viewingKey: Joi.string().required()
  })
  .custom((value: Secret20Currency) => {
    if (
      value.coinMinimalDenom.startsWith(
        `${value.type}:${value.contractAddress}:`
      )
    ) {
      return value;
    } else {
      value.coinMinimalDenom =
        `${value.type}:${value.contractAddress}:` + value.coinMinimalDenom;
      return value;
    }
  });

export const Bech32ConfigSchema = Joi.object<Bech32Config>({
  bech32PrefixAccAddr: Joi.string().required(),
  bech32PrefixAccPub: Joi.string().required(),
  bech32PrefixValAddr: Joi.string().required(),
  bech32PrefixValPub: Joi.string().required(),
  bech32PrefixConsAddr: Joi.string().required(),
  bech32PrefixConsPub: Joi.string().required()
});

export const SuggestingBIP44Schema = Joi.object<{ coinType: number }>({
  coinType: Joi.number()
    .integer()
    .min(0)
    .required()
  // Alow the any keys for compatibility of cosmosJS's BIP44.
}).unknown(true);

export const ChainInfoSchema = Joi.object<SuggestingChainInfo>({
  rpc: Joi.string()
    .required()
    .uri(),
  // TODO: Handle rpc config.
  rest: Joi.string()
    .required()
    .uri(),
  // TODO: Handle rest config.
  chainId: Joi.string()
    .required()
    .min(1)
    .max(30),
  chainName: Joi.string()
    .required()
    .min(1)
    .max(30),
  stakeCurrency: CurrencySchema.required(),
  walletUrl: Joi.string().uri(),
  walletUrlForStaking: Joi.string().uri(),
  bip44: SuggestingBIP44Schema.required(),
  bech32Config: Bech32ConfigSchema.required(),
  currencies: Joi.array()
    .min(1)
    .items(CurrencySchema, CW20CurrencyShema, Secret20CurrencyShema)
    .required(),
  feeCurrencies: Joi.array()
    .min(1)
    .items(CurrencySchema)
    .required(),
  coinType: Joi.number().integer(),
  beta: Joi.boolean(),
  gasPriceStep: Joi.object({
    low: Joi.number().required(),
    average: Joi.number().required(),
    high: Joi.number().required()
  }),
  features: Joi.array()
    .items(Joi.string().valid("stargate", "cosmwasm", "secretwasm"))
    .unique()
    .custom((value: string[]) => {
      if (value.indexOf("cosmwasm") >= 0 && value.indexOf("secretwasm") >= 0) {
        throw new Error("cosmwasm and secretwasm are not compatible");
      }

      return value;
    })
});
