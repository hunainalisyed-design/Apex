import type { Environment } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { EnvironmentDto } from "../types/environments.js";

export function mapEnvironmentToDto(environment: Environment): EnvironmentDto {
  return {
    id: environment.id,
    name: environment.name,
    hdriUrl: environment.hdriUrl,
    hdriMobileUrl: environment.hdriMobileUrl,
    thumbnailUrl: environment.thumbnailUrl,
    isStudio: environment.isStudio,
    groundHeight: environment.groundHeight,
    groundRadius: environment.groundRadius,
  };
}

/** Every environment, in switcher order (Spec 28, AC-1). Global — not per-vehicle. */
export async function listEnvironments(): Promise<EnvironmentDto[]> {
  const environments = await prisma.environment.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return environments.map(mapEnvironmentToDto);
}

export async function environmentExists(id: string): Promise<boolean> {
  return (await prisma.environment.count({ where: { id } })) > 0;
}
