import { QueryReturnValue } from '@reduxjs/toolkit/dist/query/baseQueryTypes'
import { FetchBaseQueryError, FetchBaseQueryMeta } from '@reduxjs/toolkit/query/react'
import { BigintIsh, CurrencyAmount, Token } from '@uniswap/sdk-core'
import { AlphaRouter, ChainId } from '@uniswap/smart-order-router'
import * as Comlink from 'comlink'
import JSBI from 'jsbi'
import { GetQuoteResult } from 'state/routing/types'
import { processSwapRoute } from 'utils/processSwapRoute'

import { buildDependencies, DEFAULT_ROUTING_CONFIG } from './dependencies'

const routerParamsByChain = buildDependencies()

const service = {
  async getQuote({
    type,
    chainId,
    tokenIn,
    tokenOut,
    amount: amountRaw,
  }: {
    type: 'exactIn' | 'exactOut'
    chainId: ChainId
    tokenIn: { address: string; chainId: number; decimals: number; symbol?: string }
    tokenOut: { address: string; chainId: number; decimals: number; symbol?: string }
    amount: BigintIsh
  }): Promise<QueryReturnValue<GetQuoteResult, FetchBaseQueryError, FetchBaseQueryMeta>> {
    const params = routerParamsByChain[chainId]
    if (!params) {
      throw new Error('Router dependencies not initialized.')
    }

    const router = new AlphaRouter(params)

    const currencyIn = new Token(tokenIn.chainId, tokenIn.address, tokenIn.decimals, tokenIn.symbol)
    const currencyOut = new Token(tokenOut.chainId, tokenOut.address, tokenOut.decimals, tokenOut.symbol)
    const amount = CurrencyAmount.fromRawAmount(currencyIn, JSBI.BigInt(amountRaw))

    const swapRoute =
      type === 'exactIn'
        ? await router.routeExactIn(currencyIn, currencyOut, amount, undefined, DEFAULT_ROUTING_CONFIG)
        : await router.routeExactOut(currencyIn, currencyOut, amount, undefined, DEFAULT_ROUTING_CONFIG)

    // TODO: fill error
    // TODO: try catch necesasry here?
    if (!swapRoute) throw new Error('Failed to generate client side quote')

    // return GetQuoteResult for consistency with Routing API and WebWorker
    return { data: processSwapRoute(type, amount, params.poolProvider, swapRoute) }
  },
}

export type GetQuoteWorkerType = typeof service

Comlink.expose(service)
