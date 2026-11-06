import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Season } from "@/components/Season";
import { Categories } from "@/components/Categories";
import { Showcase } from "@/components/Showcase";
import { Reviews } from "@/components/Reviews";
import { Faq } from "@/components/Faq";
import { OrderForm } from "@/components/OrderForm";
import { Contacts } from "@/components/Contacts";
import { Footer } from "@/components/Footer";
import { FloatingContacts } from "@/components/FloatingContacts";
import { StorefrontProvider } from "@/components/StorefrontProvider";
import { StorefrontCart } from "@/components/StorefrontCart";

export default function Home() {
  return (
    <StorefrontProvider>
      <Nav />
      <main>
        <Hero />
        <Season />
        <Categories />
        <Showcase />
        <Reviews />
        <Faq />
        <OrderForm />
        <Contacts />
      </main>
      <Footer />
      <FloatingContacts />
      <StorefrontCart sticky />
    </StorefrontProvider>
  );
}

