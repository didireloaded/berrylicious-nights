import { MapPin, Phone, Mail, Clock, Star, Instagram } from "lucide-react";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import heroImage from "@/assets/hero-restaurant.jpg";
import { Link } from "react-router-dom";

const AboutPage = () => {
  return (
    <div className="min-h-screen pb-24">
      {/* Hero */}
      <section className="relative h-64">
        <img src={heroImage} alt="Berrylicious restaurant" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 to-background" />
        <div className="relative h-full flex items-end px-6 pb-6 max-w-lg mx-auto">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">About Berrylicious</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
              <Star className="w-4 h-4 text-primary fill-primary" /> 4.5 • Restaurant & Lounge
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
              Nestled in the heart of Freedom Plaza, Windhoek, Berrylicious is where contemporary Mediterranean cuisine meets the warmth of Namibian hospitality.
            </p>
            <p>
              From hand-crafted cocktails to dishes made with locally sourced ingredients and global inspiration, every visit is an experience — whether you're here for a quiet lunch, a lively dinner, or a late-night lounge session with friends.
            </p>
            <p>
              Our space blends indoor elegance with an open-air terrace overlooking the city — perfect for any occasion.
            </p>
          </div>
        </section>

        {/* Gallery */}
        <section className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-3">Gallery</h2>
          <div className="grid grid-cols-2 gap-2">
            {[heroImage, gallery1, gallery2, gallery3].map((img, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg">
                <img src={img} alt={`Gallery ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
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
              { day: "Monday – Thursday", hours: "11:00 – 22:00" },
              { day: "Friday – Saturday", hours: "11:00 – 00:00" },
              { day: "Sunday", hours: "10:00 – 21:00" },
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
              <span className="text-foreground">Freedom Plaza, City Centre, Windhoek, Namibia</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-5 h-5 text-primary flex-shrink-0" />
              <a href="tel:+264612345678" className="text-foreground hover:text-primary transition-colors">+264 61 234 5678</a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-5 h-5 text-primary flex-shrink-0" />
              <a href="mailto:hello@berrylicious.na" className="text-foreground hover:text-primary transition-colors">hello@berrylicious.na</a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Instagram className="w-5 h-5 text-primary flex-shrink-0" />
              <a href="https://instagram.com/berrylicious__restaurant" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary transition-colors">@berrylicious__restaurant</a>
            </div>
          </div>
        </section>

        {/* Map */}
        <section className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-3">Find Us</h2>
          <div className="rounded-lg overflow-hidden border border-border aspect-video">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3685.7!2d17.0836!3d-22.5609!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjLCsDMzJzM5LjIiUyAxN8KwMDUnMDEuMCJF!5e0!3m2!1sen!2sna!4v1"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Berrylicious location"
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
