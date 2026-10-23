import { Composition, Folder } from "remotion";
import { VIDEO } from "./brand";
import { ReelVideo } from "./Reel";
import { reels, type Lang } from "./reels";

const langs: Lang[] = ["ru", "uz"];

// Для каждого ролика из content/reels — две композиции: <id>-ru и <id>-uz
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {reels.map((reel) => (
        <Folder key={reel.id} name={reel.id}>
          {langs.map((lang) => (
            <Composition
              key={lang}
              id={`${reel.id}-${lang}`}
              component={ReelVideo}
              durationInFrames={Math.round(reel.length_sec * VIDEO.fps)}
              fps={VIDEO.fps}
              width={VIDEO.width}
              height={VIDEO.height}
              defaultProps={{ reel, lang, showSafeZones: false }}
            />
          ))}
        </Folder>
      ))}
    </>
  );
};
