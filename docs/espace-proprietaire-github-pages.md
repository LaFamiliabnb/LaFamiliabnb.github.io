# Espace propriétaire — version GitHub Pages

Branche : `feature/espace-proprietaire-github-pages`

Cette version est une version simple en HTML, CSS et JavaScript, sans React/Vite. Elle est adaptée au dépôt public `LaFamiliabnb.github.io`.

## Pages créées

- `/proprietaires/login.html`
- `/proprietaires/dashboard.html`
- `/proprietaires/rapport.html?id=ID_DU_RAPPORT`

## Tables utilisées

Le front utilise maintenant les tables Nowistay déjà présentes dans Supabase :

- `nowistay_properties` pour les logements ;
- `staff_cleaning_reports` pour les rapports ménage ;
- `owner_accounts` pour relier un utilisateur Supabase Auth à un propriétaire Nowistay.

Les anciennes tables MVP `owners`, `properties` et `cleaning_reports` ne sont plus utilisées par le front.

## Table de liaison propriétaire

Chaque propriétaire qui doit accéder au portail doit avoir :

1. un utilisateur dans Supabase Auth ;
2. une ligne dans `owner_accounts`.

Structure :

```sql
create table if not exists public.owner_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  nowistay_owner_id bigint not null,
  created_at timestamptz not null default now()
);
```

`nowistay_owner_id` doit correspondre au champ `owner_id` présent dans `nowistay_properties`.

## Sécurité RLS

Les règles RLS autorisent un propriétaire connecté à lire uniquement :

- sa ligne dans `owner_accounts` ;
- les logements `nowistay_properties` dont `owner_id = owner_accounts.nowistay_owner_id` ;
- les rapports `staff_cleaning_reports` liés à ces logements.

## Important sur les clés

Dans GitHub Pages, on peut utiliser :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` ou une clé `sb_publishable_...`

Mais il ne faut jamais mettre :

- `SUPABASE_SERVICE_ROLE_KEY`
- `NOWISTAY_API_TOKEN`

La clé `service_role` et le token Nowistay doivent rester uniquement sur OVH, côté serveur.

## Configuration Supabase côté navigateur

Copier :

```text
proprietaires/config.example.js
```

vers :

```text
proprietaires/config.js
```

Puis remplir :

```js
window.LA_FAMILIA_SUPABASE_CONFIG = {
  url: "https://nrbbwroqplegbryhgapv.supabase.co",
  anonKey: "sb_publishable_..."
};
```

Le fichier `proprietaires/config.js` est ignoré par Git pour éviter de publier une configuration locale par erreur. Pour publier l’espace propriétaire sur GitHub Pages, il faudra soit assumer de publier l’anon/publishable key dans `config.js`, soit intégrer ces deux valeurs dans `app.js`. Cette clé est publique par conception, mais la sécurité doit absolument venir des règles RLS.

## Ordre de test conseillé

1. Vérifier que `supabase/schema.sql` a été appliqué.
2. Créer un utilisateur propriétaire dans Supabase Authentication > Users.
3. Repérer son `auth_user_id`.
4. Repérer son `nowistay_owner_id` dans `nowistay_properties.owner_id`.
5. Créer une ligne dans `owner_accounts` avec ces deux valeurs.
6. Ouvrir `/proprietaires/login.html`.
7. Se connecter avec l’email et le mot de passe Supabase Auth.

## Résultat attendu

Le propriétaire peut voir :

- ses vrais logements Nowistay ;
- les vrais rapports ménage enregistrés dans `staff_cleaning_reports` ;
- le cleaner ;
- la date ;
- le commentaire ;
- la checklist ;
- les photos.
