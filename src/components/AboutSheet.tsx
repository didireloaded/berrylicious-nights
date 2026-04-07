import { MapPin, Phone, Mail, Clock, Star, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import heroImage from "@/assets/hero-restaurant.jpg";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AboutSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AboutSheet({ open, onOpenChange }: AboutSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(92dvh,880px)] rounded-t-3xl border-border p-0 flex flex-col gap-0 overflow-hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>About Berrylicious</SheetTitle>
          <SheetDescription>Story, hours, contact, and gallery.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <section className="relative h-44 shrink-0">
            <img
              src={heroImage}
              alt="Berrylicious restaurant"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 to-background" />
            <div className="relative flex h-full items-end px-6 pb-4">
              <div>
                <p className="font-display text-2xl font-bold text-foreground">About Berrylicious</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-primary text-primary" /> 4.5 · Restaurant &amp; Lounge
                </p>
              </div>
            </div>
          </section>

          <div className="space-y-8 px-6 pb-10 pt-6">
            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-foreground">Our Story</h2>
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Nestled in the heart of Freedom Plaza, Windhoek, Berrylicious is where contemporary Mediterranean
                  cuisine meets the warmth of Namibian hospitality.
                </p>
                <p>
                  From hand-crafted cocktails to dishes made with locally sourced ingredients and global inspiration,
                  every visit is an experience — whether you&apos;re here for a quiet lunch, a lively dinner, or a
                  late-night lounge session with friends.
                </p>
                <p>
                  Our space blends indoor elegance with an open-air terrace overlooking the city — perfect for any
                  occasion.
                </p>
              </div>
            </section>

            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-foreground">Gallery</h2>
              <div className="grid grid-cols-2 gap-2">
                {[heroImage, gallery1, gallery2, gallery3].map((img, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-lg">
                    <img
                      src={img}
                      alt={`Gallery ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display mb-3 flex items-center gap-2 text-xl font-semibold text-foreground">
                <Clock className="h-5 w-5 text-primary" /> Operating Hours
              </h2>
              <div className="space-y-2 rounded-lg border border-border bg-card p-4">
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

            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-foreground">Contact</h2>
              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-foreground">Rev Michael Scott St, City Centre, Windhoek, Namibia</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-5 w-5 shrink-0 text-primary" />
                  <a href="tel:+264817544473" className="text-foreground transition-colors hover:text-primary">
                    +264 81 754 4473
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-5 w-5 shrink-0 text-primary" />
                  <a href="mailto:hello@berrylicious.na" className="text-foreground transition-colors hover:text-primary">
                    hello@berrylicious.na
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Instagram className="h-5 w-5 shrink-0 text-primary" />
                  <a
                    href="https://instagram.com/berrylicious__restaurant"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground transition-colors hover:text-primary"
                  >
                    @berrylicious__restaurant
                  </a>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-foreground">Find Us</h2>
              <div className="aspect-video overflow-hidden rounded-lg border border-border">
                <iframe
                  src="https://maps.google.com/maps?q=Berrylicious+Restaurant+Rev+Michael+Scott+St+Windhoek+Namibia&z=17&hl=en&ie=UTF8&iwloc=&output=embed"
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

            <div className="flex gap-3">
              <Link
                to="/booking"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-xl bg-primary py-3.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.97]"
              >
                Book a Table
              </Link>
              <Link
                to="/menu"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-xl border border-primary py-3.5 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-[0.97]"
              >
                View Menu
              </Link>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
