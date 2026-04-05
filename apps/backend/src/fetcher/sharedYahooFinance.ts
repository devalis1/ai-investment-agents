import "./networkDefaults";
import YahooFinance from "yahoo-finance2";
import { env } from "../config/env";
import { createTimeoutFetch } from "./timeoutFetch";

type YahooCtorOpts = NonNullable<ConstructorParameters<typeof YahooFinance>[0]>;

const yfOptions: YahooCtorOpts = {
  suppressNotices: ["yahooSurvey"],
  fetch: createTimeoutFetch(env.YAHOO_FETCH_TIMEOUT_MS),
  queue: { concurrency: 1 },
  ...(env.YAHOO_FINANCE_QUERY_HOST
    ? { YF_QUERY_HOST: env.YAHOO_FINANCE_QUERY_HOST }
    : {}),
};

/** Single client so cookies/crumb state is shared across quote, chart, and search. */
export const sharedYahooFinance = new YahooFinance(yfOptions);
