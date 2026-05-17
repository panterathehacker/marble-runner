import * as THREE from "three";

// Our Mixamo characters use "mixamorig:" as a bone-name prefix (e.g. "mixamorig:Hips").
// ReadyPlayerMe avatars use bare names ("Hips", "Spine", etc.).
// Three.js AnimationClip track names are "<boneName>.<property>"
// e.g. "mixamorig:Hips.quaternion"
//
// When applying clips to an RPM avatar the mixer looks for "mixamorig:Hips" in
// the scene hierarchy, can't find it, and silently skips the track. This
// retargeter detects the mismatch and rewrites the track names to match the
// avatar's actual bone naming convention before the clips are handed to
// CharacterAnimation.

function detectClipPrefix(clips: THREE.AnimationClip[]): string {
  // Mixamo exports two conventions:
  //   "mixamorig:Hips.quaternion" (colon separator)
  //   "mixamorigHips.quaternion"  (no separator — prefix is the lowercase portion)
  // Detect whichever is present.
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const colonIdx = track.name.indexOf(":");
      if (colonIdx !== -1) return track.name.slice(0, colonIdx + 1); // "mixamorig:"
      // No colon: check for lowercase prefix run before first uppercase letter
      const dot = track.name.indexOf(".");
      const bone = dot !== -1 ? track.name.slice(0, dot) : track.name;
      const upper = bone.search(/[A-Z]/);
      if (upper > 0) return bone.slice(0, upper); // e.g. "mixamorig"
    }
  }
  return "";
}

function detectAvatarPrefix(root: THREE.Object3D): string {
  let prefix = "";
  root.traverse((obj) => {
    if (prefix) return;
    // Only inspect Bone nodes — mesh/armature names often contain colons that
    // are unrelated to the skeleton's naming convention and would corrupt the prefix.
    if (!(obj as any).isBone) return;
    const colon = obj.name.indexOf(":");
    if (colon !== -1) prefix = obj.name.slice(0, colon + 1);
  });
  return prefix; // "" means bare names (Avaturn/RPM convention)
}

export function retargetClipsForAvatar(
  clips: THREE.AnimationClip[],
  avatarRoot: THREE.Object3D,
): THREE.AnimationClip[] {
  const clipPrefix   = detectClipPrefix(clips);
  const avatarPrefix = detectAvatarPrefix(avatarRoot);

  console.log(`[Retargeter] clipPrefix="${clipPrefix}" avatarPrefix="${avatarPrefix}"`);

  if (clipPrefix === avatarPrefix) return clips; // already compatible, no-op

  return clips.map((clip) => {
    const newTracks = clip.tracks.map((track) => {
      const dot      = track.name.lastIndexOf(".");
      const bonePart = track.name.slice(0, dot);
      const propPart = track.name.slice(dot); // ".quaternion" / ".position" / ".scale"

      // Strip the clip's prefix then prepend the avatar's prefix
      const bare    = bonePart.startsWith(clipPrefix) ? bonePart.slice(clipPrefix.length) : bonePart;
      const newName = avatarPrefix + bare + propPart;

      // Re-create the track with the new name; preserve times/values/interpolation
      const Ctor = (track as any).constructor as new (
        name: string, times: any, values: any, interpolation?: number
      ) => THREE.KeyframeTrack;
      return new Ctor(newName, track.times.slice(), (track as any).values.slice(), track.getInterpolation());
    });

    return new THREE.AnimationClip(clip.name, clip.duration, newTracks, clip.blendMode);
  });
}
