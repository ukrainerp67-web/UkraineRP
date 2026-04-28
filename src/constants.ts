export interface BusinessMetadata {
  id: string;
  name: string;
  category: 'retail' | 'gas' | 'auto' | 'football' | 'logistics';
  price: number;
  stockCost: number; // Вартість закупівлі товару / організації
  opex: number;      // Щоденне утримання
  gross: number;      // Валовий дохід
  image: string;
  actionText: string;
  collectText: string;
}

export const BUSINESS_TYPES: BusinessMetadata[] = [
  // 🛒 Retail
  {
    id: 'tavria',
    name: 'Таврія В',
    category: 'retail',
    price: 25000,
    stockCost: 10000,
    opex: 2000,
    gross: 15000,
    actionText: 'Купити товар на склад',
    collectText: 'Зібрати прибуток',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'atb',
    name: 'АТБ',
    category: 'retail',
    price: 50000,
    stockCost: 20000,
    opex: 4000,
    gross: 30000,
    actionText: 'Купити товар на склад',
    collectText: 'Зібрати прибуток',
    image: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'novus',
    name: 'Novus',
    category: 'retail',
    price: 100000,
    stockCost: 40000,
    opex: 8000,
    gross: 60000,
    actionText: 'Купити товар на склад',
    collectText: 'Зібрати прибуток',
    image: 'https://images.unsplash.com/photo-1604719312563-8912e9223c6a?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'silpo',
    name: 'Сільпо',
    category: 'retail',
    price: 180000,
    stockCost: 70000,
    opex: 12000,
    gross: 105000,
    actionText: 'Купити товар на склад',
    collectText: 'Зібрати прибуток',
    image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=800'
  },
  // ⛽ Gas Stations
  {
    id: 'klo',
    name: 'KLO',
    category: 'gas',
    price: 80000,
    stockCost: 30000,
    opex: 5000,
    gross: 45000,
    actionText: 'Замовити бензовози',
    collectText: 'Зібрати касу',
    image: 'https://images.unsplash.com/photo-1563206767-5b18f218519d?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'wog',
    name: 'WOG',
    category: 'gas',
    price: 150000,
    stockCost: 55000,
    opex: 9000,
    gross: 85000,
    actionText: 'Замовити бензовози',
    collectText: 'Зібрати касу',
    image: 'https://images.unsplash.com/photo-1545127398-14699f92334b?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'okko',
    name: 'OKKO',
    category: 'gas',
    price: 220000,
    stockCost: 80000,
    opex: 14000,
    gross: 125000,
    actionText: 'Замовити бензовози',
    collectText: 'Зібрати касу',
    image: 'https://images.unsplash.com/photo-1510332811516-72bd21096fe3?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'socar',
    name: 'Socar',
    category: 'gas',
    price: 350000,
    stockCost: 130000,
    opex: 22000,
    gross: 205000,
    actionText: 'Замовити бензовози',
    collectText: 'Зібрати касу',
    image: 'https://images.unsplash.com/photo-1621251919246-86d1ea85718e?auto=format&fit=crop&q=80&w=800'
  },
  // 🚗 Auto Dealers
  {
    id: 'skoda',
    name: 'Skoda Center',
    category: 'auto',
    price: 200000,
    stockCost: 10000,
    opex: 10000,
    gross: 135000,
    actionText: 'Імпортувати авто',
    collectText: 'Продати партію',
    image: 'https://images.unsplash.com/photo-1550304084-367d30ca4d91?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'vw',
    name: 'Volkswagen',
    category: 'auto',
    price: 400000,
    stockCost: 200000,
    opex: 18000,
    gross: 275000,
    actionText: 'Імпортувати авто',
    collectText: 'Продати партію',
    image: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'bmw',
    name: 'BMW Hub',
    category: 'auto',
    price: 750000,
    stockCost: 350000,
    opex: 30000,
    gross: 500000,
    actionText: 'Імпортувати авто',
    collectText: 'Продати партію',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'porsche',
    name: 'Porsche Center',
    category: 'auto',
    price: 1500000,
    stockCost: 700000,
    opex: 50000,
    gross: 1000000,
    actionText: 'Імпортувати авто',
    collectText: 'Продати партію',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=800'
  },
  // ⚽ Football
  {
    id: 'rukh',
    name: 'ФК Рух',
    category: 'football',
    price: 300000,
    stockCost: 20000,
    opex: 15000,
    gross: 60000,
    actionText: 'Організувати матч',
    collectText: 'Отримати прибуток',
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'polissya',
    name: 'ФК Полісся',
    category: 'football',
    price: 500000,
    stockCost: 35000,
    opex: 20000,
    gross: 105000,
    actionText: 'Організувати матч',
    collectText: 'Отримати прибуток',
    image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'dynamo',
    name: 'Динамо Київ',
    category: 'football',
    price: 800000,
    stockCost: 50000,
    opex: 30000,
    gross: 155000,
    actionText: 'Організувати матч',
    collectText: 'Отримати прибуток',
    image: 'https://images.unsplash.com/photo-1614632537423-1e6c2e7a03bc?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'shakhtar',
    name: 'Шахтар Донецьк',
    category: 'football',
    price: 1000000,
    stockCost: 60000,
    opex: 35000,
    gross: 190000,
    actionText: 'Організувати матч',
    collectText: 'Отримати прибуток',
    image: 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?auto=format&fit=crop&q=80&w=800'
  },
  // ✈️ Logistics
  {
    id: 'logistics_trucks',
    name: 'Транспортна компанія (Фури)',
    category: 'logistics',
    price: 450000,
    stockCost: 50000,
    opex: 25000,
    gross: 120000,
    actionText: 'Сплатити рейс',
    collectText: 'Отримати оплату',
    image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'airline',
    name: 'Авіакомпанія',
    category: 'logistics',
    price: 2500000,
    stockCost: 200000,
    opex: 50000,
    gross: 400000,
    actionText: 'Сплатити паливо',
    collectText: 'Отримати оплату',
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109c0f2?auto=format&fit=crop&q=80&w=800'
  }
];
