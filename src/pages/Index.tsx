import { Layout } from '@/components/layout/Layout';
import { HeroSection } from '@/components/home/HeroSection';

const Index = () => {
  return (
    <Layout>
      {/* No 'Get Started' button here. User is already in the app. */}
      <HeroSection />
    </Layout>
  );
};
export default Index;