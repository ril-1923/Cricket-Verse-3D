export interface Stadium { id: string; name: string; city: string; rx: number; rz: number; grassA: string; grassB: string; stand: string; accent: string; capacity: string; }
export const STADIUMS: Stadium[] = [
  { id: 'marina', name: 'Marina Oval', city: 'Coastal City', rx: 58, rz: 64, grassA: '#2f8f3a', grassB: '#277a31', stand: '#3a4a6b', accent: '#f2c14e', capacity: '48,000' },
  { id: 'harbour', name: 'Harbour Park', city: 'Port Town', rx: 54, rz: 60, grassA: '#3a9a46', grassB: '#2f8238', stand: '#52425f', accent: '#5ad1c2', capacity: '36,000' },
  { id: 'granite', name: 'Granite Bowl', city: 'Hill Station', rx: 62, rz: 68, grassA: '#2a8240', grassB: '#236c35', stand: '#4a4f57', accent: '#ff7a59', capacity: '62,000' },
];
export const getStadium = (id: string) => STADIUMS.find((s) => s.id === id) ?? STADIUMS[0];
