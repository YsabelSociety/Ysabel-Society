"use client";

import { motion, Variants } from "framer-motion";
import Link from "next/link";
import Image, { StaticImageData } from "next/image";
import Header from "../components/Header/Header";
import { InfiniteText } from "../components/text";
import asianMenuImage from "../../../public/assets/asian.png";
import italianMenuImage from "../../../public/assets/italian.png";
import gardenMenuImage from "../../../public/assets/garden.png";
import backgroundImage from "../../../public/assets/ysabel-1.png";

type MenuButton = {
    label: string;
    title: string;
    href: string;
    buttonClass: string;
    image: StaticImageData;
};

const buttons: MenuButton[] = [
    {
        label: "View Menu",
        title: "Asian Menu",
        href: "/food-menu/asian",
        buttonClass: "bg-[#BA8424] text-white",
        image: asianMenuImage,
    },
    {
        label: "View Menu",
        title: "Italian Menu",
        href: "/food-menu/italian",
        buttonClass: "bg-[#BA8424] text-white",
        image: italianMenuImage,
    },
    {
        label: "View Menu",
        title: "Garden Menu",
        href: "/food-menu/garden",
        buttonClass: "bg-[#BA8424] text-white",
        image: gardenMenuImage,
    },
];

const easeBezier = [0.16, 1, 0.3, 1] as const;

const variants: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: 0.15 * i, duration: 0.6, ease: easeBezier },
    }),
};

const FoodMenuPage = () => {
    return (
        <div className="relative bg-[#1D3428] lg:min-h-screen text-white flex flex-col overflow-hidden">
            <Image
                src={backgroundImage}
                alt="Food menu background"
                fill
                priority
                className="object-cover opacity-30"
                sizes="100vw"
            />
            <div className="absolute inset-0 bg-[#1D3428]/50" />
            <div className="relative z-10 flex flex-col min-h-screen">
                <Header />
                <div className="flex-1 flex flex-col lg:items-center lg:justify-center pt-32 lg:pt-20 pb-16 px-4 md:px-8">
                    <motion.h1
                        className="text-3xl lg:text-[70px] font-rhiffiral text-center pt-36 mb-4 tracking-wide text-[#BA8424]"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                        Explore our food menus
                    </motion.h1>
                    <motion.p
                        className="max-w-2xl text-center font-roboto text-base lg:text-[20px] text-white  mb-6"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                        Discover three distinct culinary journeys crafted by our chefs—from vibrant Asian flavors to hearty Italian classics and fresh garden-inspired dishes.
                    </motion.p>
                    <motion.p
                        className="max-w-2xl text-center font-roboto text-base lg:text-[20px] text-[#BA8424] leading-relaxed mb-10"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                       Choose your path below!
                    </motion.p>
                    <motion.div
                        className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-14"
                        initial="hidden"
                        animate="visible"
                    >
                        {buttons.map((btn, index) => (
                            <Link key={btn.title} href={btn.href} className="block">
                                <motion.div
                                    custom={index + 1}
                                    variants={variants}
                                    
                                    className="group relative w-full h-64 md:h-[50vh] overflow-hidden bg-black/20 transition-transform duration-500 ease-out hover:-translate-y-2 cursor-pointer"
                                >
                                    <Image
                                        src={btn.image}
                                        alt={btn.title}
                                        width={960}
                                        height={640}
                                        sizes="(min-width:1024px) 480px, 90vw"
                                        priority
                                        
                                        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/30 transition-colors duration-500 ease-out group-hover:bg-black/10" />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center transition-transform duration-500 ease-out group-hover:-translate-y-1">
                                        <h2 className="text-white text-2xl md:text-3xl font-rhiffiral tracking-wide drop-shadow-lg">
                                            {btn.title}
                                        </h2>
                                        <div className="flex justify-center">
                                            <span
                                                className={`relative inline-flex items-center justify-center px-10 md:px-12 py-3 md:py-4 uppercase tracking-[0.35em] text-[0.65rem] md:text-sm font-semibold shadow-md transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75)] before:absolute before:inset-0 before:bg-white/15 before:opacity-0 before:transition-opacity before:duration-300 before:content-[''] group-hover:before:opacity-100 ${btn.buttonClass}`}
                                            >
                                                {btn.label}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </motion.div>
                </div>
            </div>
            <InfiniteText
                phrases={["Ysabel", "Ysabel"]}
                secondaryPhrases={["Society", "Society"]}
                durationSeconds={15}
                secondaryDurationSeconds={14}
            />
        </div>
    );
};

export default FoodMenuPage;
