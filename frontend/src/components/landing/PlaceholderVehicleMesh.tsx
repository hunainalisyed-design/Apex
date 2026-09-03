"use client";

/**
 * Procedural stand-in for the hero vehicle, built from primitive geometry — no GLB asset
 * exists yet (see docs/CLAUDE.md's known open blocker, and Spec 2/4 Risk #1). This is a
 * real, interactive 3D object (not an image), satisfying SRS §32's "no fake interactions"
 * rule while a production model is sourced. Swapping in a real GLB later only requires
 * replacing this component — the surrounding Canvas/camera/controls pipeline is unchanged.
 */
export function PlaceholderVehicleMesh() {
  return (
    <group position={[0, -0.3, 0]}>
      {/* body */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.5, 1.1]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* cabin */}
      <mesh position={[-0.15, 0.68, 0]} castShadow>
        <boxGeometry args={[1.2, 0.4, 0.95]} />
        <meshStandardMaterial color="#0a0a0c" metalness={0.4} roughness={0.2} />
      </mesh>
      {/* wheels */}
      {[
        [0.85, 0, 0.6],
        [0.85, 0, -0.6],
        [-0.85, 0, 0.6],
        [-0.85, 0, -0.6],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 24]} />
          <meshStandardMaterial color="#111114" metalness={0.2} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
