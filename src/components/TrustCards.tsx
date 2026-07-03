import { CheckCircle, Truck, Phone, RotateCcw } from "lucide-react";

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

const TrustCards = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {trustItems.map((item, i) => (
        <div
          key={i}
          className="bg-card rounded-[5px] p-5 shadow-sm border border-border/50 text-center space-y-2"
        >
          <item.icon className="h-8 w-8 mx-auto text-primary" />
          <h4 className="font-semibold text-sm">{item.title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
        </div>
      ))}
    </div>
  );
};

export default TrustCards;
