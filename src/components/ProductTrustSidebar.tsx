import { CheckCircle, Truck, Phone, RotateCcw } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const trustItems = [
  {
    icon: CheckCircle,
    title: "কেন আমরা সেরা?",
    desc: "আমাদের প্রতিটি পণ্য পাঠানোর আগে মান যাচাই করা হয়, যাতে আপনি আসল ও মানসম্মত পণ্য পান।",
  },
  {
    icon: Truck,
    title: "দ্রুত ডেলিভারি",
    desc: "ঢাকায় ১–২ দিন এবং ঢাকার বাইরে ২–৫ দিনের মধ্যে ডেলিভারি করা হয়। ক্যাশ অন ডেলিভারি সুবিধাতে।",
  },
  {
    icon: Phone,
    title: "বিশ্বস্ত কাস্টমার সাপোর্ট",
    desc: "অর্ডার থেকে শুরু করে ডেলিভারির হওয়ার পরও যেকোন সমস্যায় আমরা কাস্টমার সাপোর্ট দিয়ে থাকি।",
  },
  {
    icon: RotateCcw,
    title: "সহজ রিটার্ন সুবিধা",
    desc: "পণ্য ভেদে ৩ দিনের মধ্যে কোনো সমস্যা হলে রিটার্ন সুবিধা রয়েছে। কাস্টমার সন্তুষ্টিই আমাদের মূল লক্ষ্য।",
  },
];

const TrustCard = ({ item, centered = false }: { item: typeof trustItems[number]; centered?: boolean }) => (
  <div className={`bg-card rounded-[5px] border border-primary shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_25px_rgba(0,0,0,0.2)] transition-shadow ${centered ? 'flex flex-col items-center text-center gap-3 p-5' : 'flex items-start gap-3 p-3.5'}`}>
    <div className="bg-primary/10 rounded-xl p-3 shrink-0">
      <item.icon className="h-6 w-6 text-primary" />
    </div>
    <div className={`flex flex-col gap-1.5 ${centered ? 'items-center' : ''}`}>
      <h4 className="font-bold text-[15px] leading-tight text-foreground">{item.title}</h4>
      <p className="text-[13px] text-black dark:text-white leading-snug">{item.desc}</p>
    </div>
  </div>
);

const ProductTrustSidebar = () => {
  return (
    <>
      {/* Mobile: Slider */}
      <div className="lg:hidden">
        <Carousel opts={{ align: "start", loop: true }} className="w-full">
          <CarouselContent className="-ml-2">
            {trustItems.map((item, i) => (
              <CarouselItem key={i} className="pl-2 basis-[85%] sm:basis-[48%]">
                <TrustCard item={item} centered />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Desktop: Stacked */}
      <div className="hidden lg:flex flex-col gap-3">
        {trustItems.map((item, i) => (
          <TrustCard key={i} item={item} />
        ))}
      </div>
    </>
  );
};

export default ProductTrustSidebar;
