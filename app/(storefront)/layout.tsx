import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { OrderForm } from "@/components/OrderForm";
import { Contacts } from "@/components/Contacts";
import { Footer } from "@/components/Footer";
import { FloatingContacts } from "@/components/FloatingContacts";
import { StorefrontProvider } from "@/components/StorefrontProvider";
import { StorefrontCart } from "@/components/StorefrontCart";

/** Keep cart, contact details and pending requests mounted across both catalog pages. */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <StorefrontProvider>
      <Nav />
      <main>
        {children}
        <OrderForm />
        <Contacts />
      </main>
      <Footer />
      <FloatingContacts />
      <StorefrontCart sticky />
    </StorefrontProvider>
  );
}
