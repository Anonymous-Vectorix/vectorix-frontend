import { Layout } from '@/components/layout/Layout';
import { StudyPlanSection } from '@/components/home/StudyPlanSection';

export default function StudyPlanPage() {
  return (
    <Layout>
      <div className="relative min-h-[90vh] px-4 py-12 md:px-12 max-w-7xl mx-auto overflow-visible">
        {/* Background is now handled inside StudyPlanSection.tsx for perfect consistency */}
        <StudyPlanSection />
      </div>
    </Layout>
  );
}