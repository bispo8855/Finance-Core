import { financeService as mockService } from './mockFinanceService';
import { IFinanceService } from './financeService';

// Proxy definition to allow easily swapping out implementations in the future (e.g. SupabaseService)
export const financeService: IFinanceService = mockService;
