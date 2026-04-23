/** @type {import('next').NextConfig} */

const nextConfig = {
  /** Скрыть плашку Next.js в углу (в dev); в production её нет */
  devIndicators: false,
  transpilePackages: [
    'rc-util',
    'rc-pagination',
    'rc-picker',
    '@ant-design/icons',
    '@ant-design/icons-svg',
    'antd',
  ],
  reactStrictMode: true,
  images: {
    qualities: [100, 75],
  },
};

export default nextConfig;
