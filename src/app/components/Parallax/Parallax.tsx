"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ParallaxImage = {
  src: string;
  alt: string;
};

type ParallaxSection = {
  src: string;
  title: string;
  description: string;
  images: ParallaxImage[];
  overlayColor: string;
  href: string;
};

const parallaxSections: ParallaxSection[] = [
  {
    src: "/assets/asian-asian.png",
    title: "Asian Menu",
    description:
      "Experience bold aromatics, delicate textures, and seasonal produce woven into contemporary Asian plates.",
    images: [
      {
        src: "/assets/asian.png",
        alt: "Plated Asian cuisine with garnish",
      },
      {
        src: "/assets/6I9A0496.png",
        alt: "Chef finishing an Asian-inspired dish",
      },
    ],
    overlayColor: "rgba(0, 0, 0, 0.42)",
    href: "/food-menu/asian",
  },
  {
    src: "/assets/ysabel-1.png",
    title: "Italian Menu",
    description:
      "Handmade pastas, heritage sauces, and tableside finishes evoke the warmth of modern Italian dining.",
    images: [
      {
        src: "/assets/italian.png",
        alt: "Italian pasta served on a rustic table",
      },
      {
        src: "/assets/good IMG_7834.png",
        alt: "Chef preparing Italian cuisine",
      },
    ],
    overlayColor: "rgba(38, 24, 17, 0.4)",
    href: "/food-menu/italian",
  },
  {
    src: "/assets/ysabel-2.png",
    title: "Garden Menu",
    description:
      "Fresh herbs, vibrant produce, and botanical cocktails showcase the flavours of our garden terrace.",
    images: [
      {
        src: "/assets/garden.png",
        alt: "Garden-inspired dish on an outdoor table",
      },
      {
        src: "/assets/asian good 6I9A0405 (1).png",
        alt: "Fresh cocktail with garden garnish",
      },
    ],
    overlayColor: "rgba(0, 0, 0, 0.4)",
    href: "/food-menu/garden",
  },
];

const Parallax = () => {
  const containerRef = useRef<HTMLElement | null>(null);
  const layersRef = useRef<HTMLDivElement[]>([]);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();

  const handleNavigate = (href: string) => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    router.push(href);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sectionsLength = parallaxSections.length;
    let animationFrame = 0;

    const updateLayers = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(rect.height - viewportHeight, 1);
      const scrolled = Math.min(Math.max(-rect.top, 0), maxScroll);
      const progress = scrolled / maxScroll;
      const segment = 1 / sectionsLength;

      let currentIndex = activeIndexRef.current;
      let maxOpacity = -Infinity;

      layersRef.current.forEach((layer, index) => {
        if (!layer) {
          return;
        }

        const start = index * segment;
        const mid = start + segment / 2;
        const distance = Math.abs(progress - mid);
        const opacity = Math.max(1 - distance / (segment / 2), 0);
        const translateY = distance * viewportHeight * -0.1;
        const depthStrength = 0.22;
        const activeScale = 1.08;
        const scale =
          activeScale +
          depthStrength * (Math.pow(1 - opacity, 3) * (index <= activeIndexRef.current ? -1 : 1));

        let adjustedOpacity = opacity;
        let adjustedTranslateY = translateY;
        let adjustedScale = scale;

        if (index === sectionsLength - 1 && progress >= start + segment / 2) {
          adjustedOpacity = 1;
          adjustedTranslateY = 0;
          adjustedScale = 1;
        } else if (index === 0 && progress <= segment / 2) {
          adjustedOpacity = 1;
          adjustedTranslateY = 0;
          adjustedScale = 1;
        }

        layer.style.opacity = adjustedOpacity.toFixed(3);
        layer.style.transform = `scale(${adjustedScale.toFixed(3)}) translate3d(0, ${adjustedTranslateY.toFixed(
          2
        )}px, 0)`;

        if (adjustedOpacity > maxOpacity) {
          maxOpacity = adjustedOpacity;
          currentIndex = index;
        }
      });

      if (currentIndex !== activeIndexRef.current) {
        activeIndexRef.current = currentIndex;
        setActiveIndex(currentIndex);
      }
    };

    const handleScroll = () => {
      if (animationFrame) {
        return;
      }
      animationFrame = window.requestAnimationFrame(() => {
        updateLayers();
        animationFrame = 0;
      });
    };

    updateLayers();
      window.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  const activeSection = parallaxSections[activeIndex];

  return (
    <section
      ref={containerRef}
      className="relative w-full pt-8 lg:pt-0 2xl:pt-20"
      style={{ height: `320vh` }}
    >
      <div className="sticky top-0 flex h-fit lg:h-screen w-full items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {parallaxSections.map(({ src }, index) => {
            return (
              <div
                key={src}
                className="parallax-layer absolute inset-0"
                ref={(element) => {
                  if (element) {
                    layersRef.current[index] = element;
                  }
                }}
                style={{
                  backgroundImage: `url(${src})`,
                  zIndex: 10 + index,
                  opacity: index === 0 ? 1 : 0,
                }}
              />
            );
          })}
        </div>
        <div
          className="absolute inset-0 transition-colors duration-700 ease-out"
          style={{
            zIndex: 10 + parallaxSections.length + 1,
            background: activeSection.overlayColor,
          }}
        />

        <div className="relative z-40 mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-8 px-6 text-center text-[#BA8424] transition-all duration-500">
          <div
            key={activeSection.title}
            className="flex flex-col items-center gap-4 animate-fadeInScale"
          >
            <h2
              className="font-rhiffiral pt-16 text-[clamp(3.2rem,6.5vw,6.8rem)] font-light uppercase tracking-[0.2em] leading-[1.05]"
              style={{ textShadow: "0 14px 34px rgba(0,0,0,0.55)" }}
            >
              {activeSection.title}
            </h2>
            <p className="mx-auto max-w-3xl mt-6 font-roboto text-[16px] leading-tight text-white md:text-base lg:text-[20px] animate-menuStagger">
              {activeSection.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleNavigate(activeSection.href)}
              className="group inline-flex items-center justify-center gap-2 px-6 py-2 text-[14px] font-roboto lg:text-[23px] uppercase tracking-[0.38em] text-[#BA8424] transition-all duration-300 hover:tracking-[0.40em] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:text-xs cursor-pointer"
            >
              <span className="relative">
                <span className="absolute inset-x-0 bottom-0 h-px bg-[#BA8424] opacity-0 transition-opacity duration-300 group-hover:opacity-80" />
                View {activeSection.title}
              </span>
              <span className="relative flex h-8 w-8 items-center justify-center">
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="relative text-[#BA8424] transition-transform duration-300 group-hover:translate-x-1.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </span>
            </button>
          </div>

          <div
            key={`${activeSection.title}-gallery`}
            className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-6 md:flex-row md:items-center md:gap-12"
          >
            {activeSection.images.map(({ src, alt }, index) => (
              <div
                key={`${src}-${index}`}
                className="flex w-full max-w-sm flex-1 items-center justify-center animate-fadeInScale"
                style={{ animationDelay: `${0.15 * index + 0.15}s` }}
              >
                <Image
                  src={src}
                  alt={alt}
                  width={520}
                  height={680}
                  className="h-auto max-h-[360px] w-full object-contain"
                  sizes="(min-width: 1280px) 24vw, (min-width: 768px) 32vw, 80vw"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none select-none" />
    </section>
  );
};

export default Parallax;

