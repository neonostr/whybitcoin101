import { useState, useEffect } from 'react';
import { SimplePool, Event, nip19 } from 'nostr-tools';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";

interface ProfileData {
  npub: string;
  name?: string;
  picture?: string;
  display_name?: string;
}

const NostrContributors = () => {
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);

  const npubs = [
    'npub1aftmyhm62lrp6lwsha3yzyjy5kqdvuy7g23qg28a8q0cnmudv0ds0sdcke',
    'npub1lyqkzmcq5cl5l8rcs82gwxsrmu75emnjj84067kuhm48e9w93cns2hhj2g',
    'npub1h882a66p0zj5n69s2u8nfzev4f97lzfnlcej84z78p6uqxge5tpqlupz20',
    'npub1h8nk2346qezka5cpm8jjh3yl5j88pf4ly2ptu7s6uu55wcfqy0wq36rpev',
    'npub1gdu7w6l6w65qhrdeaf6eyywepwe7v7ezqtugsrxy7hl7ypjsvxksd76nak',
    'npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc',
    'npub1ahxjq4v0zlvexf7cg8j9stumqp3nrtzqzzqxa7szpmcdgqrcumdq0h5ech',
    'npub1cn4t4cd78nm900qc2hhqte5aa8c9njm6qkfzw95tszufwcwtcnsq7g3vle',
    'npub1sk7mtp67zy7uex2f3dr5vdjynzpwu9dpc7q4f2c8cpjmguee6eeq56jraw',
    'npub1dtgg8yk3h23ldlm6jsy79tz723p4sun9mz62tqwxqe7c363szkzqm8up6m',
    'npub16le69k9hwapnjfhz89wnzkvf96z8n6r34qqwgq0sglas3tgh7v4sp9ffxj',
    'npub1az9xj85cmxv8e9j9y80lvqp97crsqdu2fpu3srwthd99qfu9qsgstam8y8',
    'npub1s0vtkgej33n7ec4d7ycxmwt78up8hpfa30d0yfksrshq7t82mchqynpq6j',
    'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m',
    'npub1v60thnx0gz0wq3n6xdnq46y069l9x70xgmjp6lprdl6fv0eux6mqgjj4rp',
    'npub1lr2zzf989mvf393y0tv39ara6a4vddkd6y87z784up9vl6ks6j3qtudl6a',
    'npub1864jglrrhv6alguwql9pqtmd5296nww5dpcewapmmcazk8vq4mks0tt2tq',
    'npub1cn670f663n3ks02jnnlsvd5y88zjnefy8343ykaxs7y3nzzketrsrjwt8a',
    'npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a',
    'npub1cvqlzvmjercdn0ypsmv8f7j9lge6ahsnueh5rparh53wuswftv4q49yjt3',
    'npub1tkey6tcfk0jf2ageje7xvqnnph4443h4pc4aqesuqjeywyke073qfmwral',
    'npub1yul83qxn35u607er3m7039t6rddj06qezfagfqlfw4qk5z5slrfqu8ncdu',
    'npub1ug2p3zc0grtlcv2pjezpj486854ghyvhc64fqv6mcyz2xnaqrv8samuhu7'

    
  ];

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const pool = new SimplePool();
        const relays = [
          'wss://relay.damus.io',
          'wss://nos.lol',
          'wss://relay.nostr.band',
          'wss://nostr.wine'
        ];

        // Convert npubs to hex pubkeys
        const pubkeys = npubs.map(npub => {
          try {
            const decoded = nip19.decode(npub);
            return decoded.type === 'npub' ? decoded.data : null;
          } catch {
            return null;
          }
        }).filter(Boolean) as string[];

        // Fetch kind 0 events (profile metadata)
        const events = await pool.querySync(relays, {
          kinds: [0],
          authors: pubkeys
        });

        // Process events to get profile data
        const profileMap = new Map<string, ProfileData>();
        
        events.forEach((event: Event) => {
          try {
            const content = JSON.parse(event.content);
            const npub = nip19.npubEncode(event.pubkey);
            
            if (!profileMap.has(event.pubkey) || 
                (profileMap.get(event.pubkey) && event.created_at > (profileMap.get(event.pubkey) as any)?.created_at)) {
              profileMap.set(event.pubkey, {
                npub,
                name: content.name,
                display_name: content.display_name,
                picture: content.picture,
                created_at: event.created_at
              } as any);
            }
          } catch (error) {
            console.error('Error parsing profile:', error);
          }
        });

        // Convert to array and maintain original order
        const profilesArray = npubs.map(npub => {
          const decoded = nip19.decode(npub);
          if (decoded.type === 'npub') {
            const profile = profileMap.get(decoded.data as string);
            return profile || { npub, name: 'Unknown', picture: undefined };
          }
          return { npub, name: 'Unknown', picture: undefined };
        });

        setProfiles(profilesArray);
        pool.close(relays);
      } catch (error) {
        console.error('Error fetching profiles:', error);
        // Fallback to show npubs without profile data
        setProfiles(npubs.map(npub => ({ npub, name: 'Loading...', picture: undefined })));
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  const handleProfileClick = (npub: string) => {
    window.open(`https://primal.net/p/${npub}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="border-primary/20 mb-6">
      <CardHeader>
        <h2 className="text-2xl font-semibold leading-none tracking-tight text-foreground flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Thank You To Our Contributors
        </h2>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground leading-relaxed mb-6">
          We're grateful to those making Bitcoin education possible - from creators whose work we feature on our site to active voices on Nostr who grow the global knowledge base.
        </p>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-4">
            {profiles.map((profile, index) => (
              <div
                key={profile.npub}
                onClick={() => handleProfileClick(profile.npub)}
                className="flex flex-col items-center cursor-pointer group transition-transform hover:scale-105"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted border-2 border-border group-hover:border-primary transition-colors">
                  {profile.picture ? (
                    <img
                      src={profile.picture}
                      alt={`Profile photo of ${profile.display_name || profile.name || 'a Nostr contributor'}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://robohash.org/${profile.npub}?size=64x64`;
                      }}
                    />
                  ) : (
                    <img
                      src={`https://robohash.org/${profile.npub}?size=64x64`}
                      alt={`Profile photo of ${profile.display_name || profile.name || 'a Nostr contributor'}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <span className="text-xs text-muted-foreground mt-2 text-center truncate w-full">
                  {profile.display_name || profile.name || 'Unknown'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NostrContributors;