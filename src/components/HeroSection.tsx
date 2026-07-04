import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import { useResellerSlug, useResellerRefValue } from "@/contexts/ResellerRefContext";

const HeroSection = () => {
  const siteHeroTitle = useSiteSettingsStore((s) => s.heroTitle);
  const siteHeroSubtitle = useSiteSettingsStore((s) => s.heroSubtitle);
  const siteHeroBackgroundImage = useSiteSettingsStore((s) => s.heroBackgroundImage);
  const resellerRef = useResellerSlug();
  const resellerValue = useResellerRefValue();
  const branding = resellerValue?.branding;

  const heroTitle = branding?.heroTitle || siteHeroTitle;
  const heroSubtitle = branding?.heroSubtitle || siteHeroSubtitle;
  const bgImage = branding?.heroImage || siteHeroBackgroundImage || '/images/hero-bg.png';

  return (
    <section
      className="relative h-[350px] overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url('${bgImage}')` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-white/0" />
      <div className="relative container-box h-full flex flex-col justify-center items-start text-left gap-4">
        <h1 className="text-[30px] md:text-[30px] font-bold leading-tight text-white whitespace-pre-line">
          {heroTitle}
        </h1>
        <p className="text-white text-lg max-w-md">
          {heroSubtitle}
        </p>
        <Link to={resellerRef ? `/r/${resellerRef}/shop` : "/shop"}>
          <Button size="lg" className="gap-2 rounded-full text-base px-8 border border-white">
            শপিং করুন
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default HeroSection;
