export const formatOvers = (legalBalls: number) => `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
export const oversToBalls = (o: number) => Math.round(o * 6);
