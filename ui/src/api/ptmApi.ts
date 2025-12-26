import type { PtmSummary } from '../types/ptm'
import { sendCommand } from './commandClient'

export const fetchPtmSummary = async (): Promise<PtmSummary> => {
  return sendCommand<PtmSummary>('ptm.summary')
}
