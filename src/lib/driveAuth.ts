// Shared in-memory caching singleton for Google Drive token
// Keeps oauth credentials safe and synchronized across active tabs/views without persisting them to store.

let cachedAccessToken: string | null = null;
let cachedEmail: string | null = null;
let cachedPicture: string | null = null;

export interface DriveAuthState {
  accessToken: string | null;
  email: string | null;
  picture: string | null;
}

const listeners = new Set<(auth: DriveAuthState) => void>();

export const getDriveAuth = (): DriveAuthState => {
  return {
    accessToken: cachedAccessToken,
    email: cachedEmail,
    picture: cachedPicture
  };
};

export const setDriveAuth = (accessToken: string | null, email: string | null, picture: string | null) => {
  cachedAccessToken = accessToken;
  cachedEmail = email;
  cachedPicture = picture;
  listeners.forEach(listener => listener({ accessToken, email, picture }));
};

export const subscribeDriveAuth = (listener: (auth: DriveAuthState) => void) => {
  listeners.add(listener);
  // Immediately evoke with current state
  listener({ accessToken: cachedAccessToken, email: cachedEmail, picture: cachedPicture });
  return () => {
    listeners.delete(listener);
  };
};
