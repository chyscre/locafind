import { Injectable, computed, signal } from '@angular/core';
import { avatarById } from './avatar';

const PROFILE_KEY = 'locafind.profile';

interface StoredProfile {
  name?: string;
  contact?: string;
  avatar?: string;
}

function read(): StoredProfile {
  try {
    return (JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as StoredProfile | null) ?? {};
  } catch {
    return {};
  }
}

/** The explorer on this phone: display name, contact, and chosen avatar. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly saved = read();

  readonly name = signal(this.saved.name ?? '');
  readonly contact = signal(this.saved.contact ?? '');
  readonly avatarId = signal(this.saved.avatar ?? 'kitty');
  readonly avatar = computed(() => avatarById(this.avatarId()));
  readonly displayName = computed(() => this.name().trim() || 'Explorer');

  update(changes: StoredProfile): void {
    if (changes.name !== undefined) this.name.set(changes.name);
    if (changes.contact !== undefined) this.contact.set(changes.contact);
    if (changes.avatar !== undefined) this.avatarId.set(changes.avatar);
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ name: this.name(), contact: this.contact(), avatar: this.avatarId() }),
      );
    } catch {
      /* not remembered */
    }
  }
}
