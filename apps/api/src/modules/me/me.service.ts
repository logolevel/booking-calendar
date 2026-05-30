import { ForbiddenException, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { OnboardingDto } from './dto/onboarding.dto';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  getStored(userId: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
  }

  // First-time onboarding only. Renaming afterwards goes through an admin.
  async completeOnboarding(userId: number, dto: OnboardingDto): Promise<User> {
    const user = await this.getStored(userId);
    if (user?.onboardedAt) {
      throw new ForbiddenException('Profile is already set');
    }
    return this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        gender: dto.gender,
        onboardedAt: new Date(),
      },
    });
  }
}
