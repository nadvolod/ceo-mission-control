import { HeroSection } from '@/components/landing/HeroSection';
import { PainPointsSection } from '@/components/landing/PainPointsSection';
import { SolutionPreview } from '@/components/landing/SolutionPreview';
import { AiCoreSection } from '@/components/landing/AiCoreSection';
import { SocialProof } from '@/components/landing/SocialProof';
import { WaitlistForm } from '@/components/landing/WaitlistForm';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <main className="bg-[#06060a] text-white min-h-screen selection:bg-indigo-500/30">
      <HeroSection />
      <PainPointsSection />
      <SolutionPreview />
      <AiCoreSection />
      <SocialProof />
      <WaitlistForm />
      <Footer />
    </main>
  );
}
