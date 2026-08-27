import HomeView from "./components/views/HomeView";
import AboutUsinHomePage from "./components/About/AboutUsinHomePage";
import Parallax from "./components/Parallax/Parallax";
import { InfiniteText } from "./components/text";

export default function Home() {
  return (
    <>
      <HomeView />
      <AboutUsinHomePage />
      <Parallax />
      <InfiniteText
        phrases={["Ysabel", "Ysabel"]}
        secondaryPhrases={["Society", "Society"]}
        durationSeconds={15}
        secondaryDurationSeconds={14}
      />
    </>
  );
}
