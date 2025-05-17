/**
 * Calculate expected returns for an investment
 * @param amount The investment amount
 * @param returnRate The annual return rate percentage
 * @param duration The investment duration in months
 * @returns The expected return amount
 */
export const calculateExpectedReturns = (
  amount: number,
  returnRate: number,
  duration: number
): number => {
  // Simple interest calculation
  return amount * (returnRate / 100) * (duration / 12);
};

/**
 * Generate a payout schedule based on investment parameters
 * @param amount The investment amount
 * @param returnRate The annual return rate percentage
 * @param duration The investment duration in months
 * @param payoutFrequency The frequency of payouts (monthly, quarterly, etc.)
 * @param startDate The investment start date
 * @returns An array of payout objects with date and amount
 */
export const generatePayoutSchedule = (
  amount: number,
  returnRate: number,
  duration: number,
  payoutFrequency: string,
  startDate: Date
): { date: Date; amount: number }[] => {
  const payouts: { date: Date; amount: number }[] = [];
  const totalReturn = calculateExpectedReturns(amount, returnRate, duration);

  let payoutInterval: number;
  switch (payoutFrequency) {
    case "monthly":
      payoutInterval = 1;
      break;
    case "quarterly":
      payoutInterval = 3;
      break;
    case "semi_annually":
      payoutInterval = 6;
      break;
    case "annually":
      payoutInterval = 12;
      break;
    case "end_of_term":
      payoutInterval = duration;
      break;
    default:
      payoutInterval = 1;
  }

  const numberOfPayouts = Math.floor(duration / payoutInterval);
  const payoutAmount = totalReturn / numberOfPayouts;

  for (let i = 0; i < numberOfPayouts; i++) {
    const payoutDate = new Date(startDate);
    payoutDate.setMonth(payoutDate.getMonth() + (i + 1) * payoutInterval);

    payouts.push({
      date: payoutDate,
      amount: payoutAmount,
    });
  }

  return payouts;
};

/**
 * Calculate the current value of an investment
 * @param investmentAmount The investment amount
 * @param returnRate The annual return rate percentage
 * @param startDate The investment start date
 * @param currentDate The current date
 * @returns The current value of the investment
 */
export const calculateCurrentValue = (
  investmentAmount: number,
  returnRate: number,
  startDate: Date,
  currentDate: Date = new Date()
): number => {
  // Calculate months elapsed
  const startTime = startDate.getTime();
  const currentTime = currentDate.getTime();
  const monthsElapsed =
    (currentTime - startTime) / (1000 * 60 * 60 * 24 * 30.44); // Average month length

  // Calculate accrued interest
  const monthlyRate = returnRate / 100 / 12;
  const accruedInterest = investmentAmount * monthlyRate * monthsElapsed;

  return investmentAmount + accruedInterest;
};

/**
 * Calculate the projected value of an investment at maturity
 * @param investmentAmount The investment amount
 * @param returnRate The annual return rate percentage
 * @param duration The investment duration in months
 * @returns The projected value at maturity
 */
export const calculateProjectedValue = (
  investmentAmount: number,
  returnRate: number,
  duration: number
): number => {
  const totalReturn = calculateExpectedReturns(
    investmentAmount,
    returnRate,
    duration
  );
  return investmentAmount + totalReturn;
};

/**
 * Calculate the annual percentage yield (APY)
 * @param returnRate The nominal annual return rate percentage
 * @param compoundingFrequency The number of times interest is compounded per year
 * @returns The APY as a percentage
 */
export const calculateAPY = (
  returnRate: number,
  compoundingFrequency = 12
): number => {
  const r = returnRate / 100;
  const n = compoundingFrequency;

  return (Math.pow(1 + r / n, n) - 1) * 100;
};
