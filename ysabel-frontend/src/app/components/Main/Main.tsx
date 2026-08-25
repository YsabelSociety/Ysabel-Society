"use client";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import Header from "../Header/Header";

const Main = () => {
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        ".heroText",
        {
          opacity: 0,
          yPercent: 20,
          filter: "blur(10px)",
        },
        {
          opacity: 1,
          yPercent: 0,
          filter: "blur(0px)",
          duration: 1.5,
        }
      ).fromTo(
        ".heroLine",
        { clipPath: "inset(0 0 100% 0)" },
        {
          clipPath: "inset(0 0 0% 0)",
          duration: 1.2,
          stagger: 0.2,
          ease: "sine.out",
        },
        "-=1"
      );
    }, textRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative firstServiceImage w-full min-h-screen lg:h-screen overflow-hidden bg-[#1D3428]">
      <Image
        src="/assets/ysabel-1.png"
        alt="Main background"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[#1D3428]/50" />
      <div className="absolute top-0 left-0 right-0 z-20">
        <Header />
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 text-white text-center">
        <div
          ref={textRef}
          className="flex flex-col items-center justify-center gap-6 pt-32 md:pt-40"
        >
          <p className="heroText text-[4vh] lg:text-[7vh] font-rhiffiral text-center leading-tight tracking-[1px] uppercase mt-[-50px] lg:mt-[-100px]">
            <span className="heroLine block">It is a temple of taste</span>
            <span className="heroLine block">and atmosphere</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Main;
