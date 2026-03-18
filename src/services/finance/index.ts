import { supabaseFinanceService } from './supabaseFinanceService';
import { IFinanceService } from './financeService';

// Proxy definition firmly set to use Supabase Service 100% of the time
export const financeService: IFinanceService = supabaseFinanceService;
