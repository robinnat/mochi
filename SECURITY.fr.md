[English](SECURITY.md) | **Français**

# Politique de sécurité

## Versions suivies

Mochi World n'est pas encore publié sur npm et n'a pas de version publiée. Seul le dernier commit de
la branche `main` est suivi. Les correctifs arrivent sur `main` ; les commits plus anciens ne sont pas
corrigés.

| Version | Suivie |
| --- | --- |
| `main` (dernière) | Oui |
| Toute version plus ancienne | Non |

## Signaler une faille

Merci de **ne pas** ouvrir d'issue, de discussion ou de pull request publique pour un problème de
sécurité.

Signalez-le plutôt en privé sur GitHub :

1. Allez dans l'[onglet Security](https://github.com/robinnat/mochi/security) du dépôt.
2. Cliquez sur **Report a vulnerability** (ou ouvrez directement
   [ce formulaire](https://github.com/robinnat/mochi/security/advisories/new)).
3. Décrivez le problème, comment le reproduire, et ce qu'un attaquant pourrait en faire.

Si vous ne pouvez pas utiliser le formulaire GitHub, écrivez en secours à sygen.contact@gmail.com, avec « Security » dans l'objet.

Seuls les mainteneurs peuvent lire le signalement. Nous l'examinerons et répondrons au mieux de nos
moyens : c'est un petit projet et nous ne pouvons promettre ni délai de réponse ni date de correctif.
Si le signalement est confirmé, le correctif arrive sur `main` par une pull request normale.

## Périmètre

Mochi World tourne dans le navigateur et n'a ni serveur, ni comptes, ni stockage de données en dehors
du `localStorage` du visiteur. Les signalements sur le code de ce dépôt et sur le site de démo construit
à partir de lui sont les bienvenus. Les problèmes des dépendances tierces sont mieux signalés à leurs
propres projets.
