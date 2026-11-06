import { Redirect, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { Note, Screen } from '../ui/kit';
import { isAppLink, metaDemoEnabled } from '../core/metaDemo';
import { META_COPY } from '../core/metaDemoCopy';
import { completeSignIn } from '../lib/metaSession';

/**
 * The link the shop page opens to hand a Facebook sign in back to the app is fb<app id>://authorize,
 * and the router reads that as this route. It finishes the sign in from the link, then lands on the
 * Page connection screen. If the sign in was already finished by another road, it is not done twice.
 * It exists only for the Phil build, which is the only build that registers that link.
 */
function Finish() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    if (!isAppLink(url)) return;
    completeSignIn(url)
      .catch(() => null)
      .finally(() => router.dismissTo('/meta'));
  }, [url]);
  return (
    <Screen>
      <Note>{META_COPY.signingIn}</Note>
    </Screen>
  );
}

export default function AuthorizeRoute() {
  return metaDemoEnabled() ? <Finish /> : <Redirect href="/" />;
}
