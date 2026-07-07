# Espace propriétaire — version GitHub Pages

Branche : `feature/espace-proprietaire-github-pages`

Cette version est une version simple en HTML, CSS et JavaScript, sans React/Vite. Elle est adaptée au dépôt public `LaFamiliabnb.github.io`.

## Pages créées

- `/proprietaires/login.html`
- `/proprietaires/dashboard.html`
- `/proprietaires/rapport.html?id=ID_DU_RAPPORT`

## Fichiers créés

- `proprietaires/login.html`
- `proprietaires/dashboard.html`
- `proprietaires/rapport.html`
- `proprietaires/style.css`
- `proprietaires/app.js`
- `proprietaires/config.example.js`
- `supabase/schema.sql`

## Important sur les clés

Dans GitHub Pages, on peut utiliser :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

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
  url: "https://ton-projet.supabase.co",
  anonKey: "ta_anon_key_supabase"
};
```

Le fichier `proprietaires/config.js` est ignoré par Git pour éviter de publier une configuration locale par erreur. Pour publier l’espace propriétaire sur GitHub Pages, il faudra soit assumer de publier l’anon key dans `config.js`, soit intégrer ces deux valeurs dans `app.js`. L’anon key Supabase est publique par conception, mais la sécurité doit absolument venir des règles RLS.

## Configuration Supabase base de données

Dans Supabase SQL Editor, exécuter :

```text
supabase/schema.sql
```

Cela crée :

- `owners`
- `properties`
- `cleaning_reports`

et active les règles RLS pour que chaque propriétaire ne voie que ses données.

## Ordre de test conseillé

1. Exécuter `supabase/schema.sql`.
2. Activer Supabase Auth email/mot de passe.
3. Créer un utilisateur propriétaire dans Authentication > Users.
4. Créer une ligne dans `owners` avec son `auth_user_id`.
5. Créer un logement dans `properties`.
6. Créer un faux rapport dans `cleaning_reports`.
7. Ouvrir `/proprietaires/login.html`.
8. Se connecter avec le compte propriétaire.

## MVP obtenu

Le propriétaire peut voir :

- ses logements ;
- les rapports ménage ;
- le cleaner ;
- la date ;
- le commentaire ;
- la checklist ;
- les photos.
