import { Hero } from "@/components/Hero";
import { Season } from "@/components/Season";
import { Categories } from "@/components/Categories";
import { Showcase } from "@/components/Showcase";
import { Reviews } from "@/components/Reviews";
import { Faq } from "@/components/Faq";

export default function Home() {
  return (
    <>
      <Hero />
      <Season />
      <Categories />
      <Showcase />
      <Reviews />
      <Faq />
    </>
  );
}
