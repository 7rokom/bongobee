import { RotateCcw, Headphones, Lock, Truck } from "lucide-react";

const badges = [
  {
    icon: RotateCcw,
    title: "৭ দিনের রিটার্ন পলিসি",
    desc: "পণ্যে কোনো সমস্যা থাকলে ৭ দিনের মধ্যে রিটার্ন বা রিফান্ড নিতে পারবেন।",
  },
  {
    icon: Headphones,
    title: "২৪/৬ লাইভ চ্যাট",
    desc: "যেকোনো সময় ইন্সট্যান্ট সহায়তা পেতে আমাদের হোয়াটসঅ্যাপ-এ যোগাযোগ করতে পারবেন।",
  },
  {
    icon: Lock,
    title: "নিরাপদ পেমেন্ট",
    desc: "ক্যাশ অন ডেলিভারি। পণ্য হাতে পেয়ে পেমেন্ট। তাই পেমেন্ট হবে নির্ভরযোগ্য ও নিরাপদ।",
  },
  {
    icon: Truck,
    title: "দ্রুত ডেলিভারি",
    desc: "বিশ্বস্ত ডেলিভারি সার্ভিসের মাধ্যমে ২ থেকে ৪ দিনের মধ্যে দ্রুত পণ্য পৌঁছে যাবে আপনার ঠিকানায়।",
  },
];

const ProductTrustBadges = () => {
  return (
    <div className="mb-4 -mx-4 sm:mx-0">
      <div className="flex flex-row lg:flex-row gap-3 px-4 sm:px-0 pb-2 overflow-x-auto lg:overflow-x-visible scrollbar-hide">
        {badges.map((b, i) => {
          const Icon = b.icon;
          return (
            <div
              key={i}
              className="flex-shrink-0 w-[280px] lg:w-auto lg:flex-1 bg-gradient-to-br from-primary to-secondary border border-secondary rounded-xl p-[10px] flex items-center gap-3"
            >
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                <Icon className="w-7 h-7 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-white text-[18px] leading-tight mb-1">
                  {b.title}
                </h4>
                <p className="text-white text-[13px] leading-snug">
                  {b.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductTrustBadges;
