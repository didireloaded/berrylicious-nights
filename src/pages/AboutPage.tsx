import { MapPin, Phone, Mail, Clock, Star, Instagram } from "lucide-react";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import heroImage from "@/assets/hero-restaurant.jpg";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";
import { Link } from "react-router-dom";

const AboutPage = () => {
  return (
    <div className="min-h-screen pb-24">
      {/* Hero */}
      <section className="relative h-64">
        <img src={heroImage} alt="Butcher Block Steakhouse Windhoek" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 to-background" />
        <div className="relative h-full flex items-end px-6 pb-6 max-w-lg mx-auto">
          <div>
            <img src={butcherBlockLogo} alt="Butcher Block Steakhouse" className="mb-2 h-9 w-auto object-contain" />
            <h1 className="font-display text-3xl font-bold text-foreground">About Butcher Block</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
              <Star className="w-4 h-4 text-primary fill-primary" /> Est. 2003 • Steakhouse &amp; Wine Cellar
            </p>
          </div>
        </div>
      </section>

      <div className="px-6 max-w-lg mx-auto space-y-8 mt-6">
        {/* Story */}
        <section className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-3">Our Story</h2>
          <div className="text-muted-foreground text-sm leading-relaxed space-y-3">
            <p>
              Established in 2003 and situated at the prestigious Am Weinberg Estate in Klein Windhoek, Butcher Block Steakhouse is where 100% Namibian, grass-fed, wet-aged A-grade beef meets warm, upmarket hospitality.
            </p>
            <p>
              Our cuts are wet-aged for a minimum of 21 days, flame-grilled over charcoal embers, and served on wooden boards with hot plates — paired with curated South African wines from our transparent glass cellar and classic craft cocktails.
            </p>
            <p>
              Blending rich leather, natural wood, and a lively yet refined atmosphere, we are the home of signature Tomahawk steaks, Tuesday Ladies&apos; Night, and Wednesday Men&apos;s Night.
            </p>
          </div>
        </section>

        {/* Gallery */}
        <section className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-3">Gallery</h2>
          <div className="grid grid-cols-2 gap-2">
            {[heroImage, gallery1, gallery2, gallery3].map((img, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg">
                <img src={img} alt={`Butcher Block Steakhouse gallery ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
              </div>
            ))}
          </div>
        </section>

        {/* Operating Hours */}
        <section className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Operating Hours
          </h2>
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            {[
              { day: "Monday – Saturday", hours: "11:30 AM – 10:00 PM" },
              { day: "Sunday", hours: "11:30 AM – 9:00 PM" },
            ].map((item) => (
              <div key={item.day} className="flex justify-between text-sm">
                <span className="text-foreground">{item.day}</span>
                <span className="text-muted-foreground">{item.hours}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-3">Contact</h2>
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-foreground">Am Weinberg Estate, 13 Jan Jonker Road, Klein Windhoek, Windhoek, Namibia</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-foreground">
                <a href="tel:+264832888000" className="hover:text-primary transition-colors">+264 83 288 8000</a>
                {" / "}
                <a href="tel:+264832888001" className="hover:text-primary transition-colors">+264 83 288 8001</a>
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-5 h-5 text-primary flex-shrink-0" />
              <a href="mailto:windhoek@butcherblock.com.na" className="text-foreground hover:text-primary transition-colors">windhoek@butcherblock.com.na</a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Instagram className="w-5 h-5 text-primary flex-shrink-0" />
              <a href="https://www.instagram.com/butcherblocknamibia/" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary transition-colors">@butcherblocknamibia</a>
            </div>
          </div>
        </section>

        {/* Map */}
        <section className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-3">Find Us</h2>
          <div className="rounded-lg overflow-hidden border border-border aspect-video">
            <iframe
              src="https://maps.google.com/maps?q=Butcher+Block+Steakhouse+Am+Weinberg+Estate+13+Jan+Jonker+Street+Windhoek+Namibia&z=17&hl=en&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Butcher Block Steakhouse location"
            />
          </div>
        </section>

        {/* CTAs */}
        <div className="flex gap-3 animate-fade-in">
          <Link
            to="/booking"
            className="flex-1 bg-primary text-primary-foreground font-semibold py-3.5 rounded-lg text-center hover:opacity-90 transition-opacity active:scale-[0.97]"
          >
            Book a Table
          </Link>
          <Link
            to="/menu"
            className="flex-1 border border-primary text-primary font-semibold py-3.5 rounded-lg text-center hover:bg-primary/10 transition-colors active:scale-[0.97]"
          >
            View Menu
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
