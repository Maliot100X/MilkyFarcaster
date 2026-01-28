
export interface Coin {
  name: string;
  symbol: string;
  address: string;
  image: string;
}

export const SUPPORTED_COINS: Coin[] = [
  {
    name: "Degen",
    symbol: "DEGEN",
    address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
    image: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/018f6734-7347-7977-84c4-79f976214f00/original"
  },
  {
    name: "Higher",
    symbol: "HIGHER",
    address: "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe",
    image: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/7a578940-0255-4034-7067-27b055964f00/original"
  },
  {
    name: "TN100x",
    symbol: "TN100X",
    address: "0x5b5dee44552546ecea05ed6014e1305c54931254",
    image: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/1e6d8955-4161-464c-7019-2187e1273900/original"
  },
  {
    name: "Mog Coin",
    symbol: "MOG",
    address: "0x2da562638713c23636496ea0aa7f6306dfe4199e",
    image: "https://assets.coingecko.com/coins/images/31338/standard/mog.png"
  },
  {
    name: "Brett",
    symbol: "BRETT",
    address: "0x532f27101965dd16442e59d40670faf5ebb142e4",
    image: "https://assets.coingecko.com/coins/images/35560/standard/brett.png"
  },
  {
    name: "Toshi",
    symbol: "TOSHI",
    address: "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4",
    image: "https://assets.coingecko.com/coins/images/31531/standard/toshi.png"
  }
];
