export interface DailyBudgetController {
  canConsume(): boolean;
  consume(): boolean;
  getRemaining(): number;
  getLimit(): number;
}

export function createDailyBudgetController(maxDailyCalls: number): DailyBudgetController {
  let currentDay = new Date().toISOString().slice(0, 10);
  let usedCalls = 0;

  function syncDay(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== currentDay) {
      currentDay = today;
      usedCalls = 0;
    }
  }

  return {
    canConsume() {
      syncDay();
      return usedCalls < maxDailyCalls;
    },
    consume() {
      syncDay();
      if (usedCalls >= maxDailyCalls) {
        return false;
      }
      usedCalls++;
      return true;
    },
    getRemaining() {
      syncDay();
      return Math.max(0, maxDailyCalls - usedCalls);
    },
    getLimit() {
      return maxDailyCalls;
    },
  };
}
