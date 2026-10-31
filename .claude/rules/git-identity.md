# Identidade do git — obrigatória

Todo commit, amend, rebase, merge, tag e push deste repositório usa **somente** esta
identidade, como autor e como committer:

```
RH Albergoni <314819085+rh-albergoni@users.noreply.github.com>
```

- Antes de commitar, confira `git config user.name && git config user.email`. Se estiver
  diferente, corrija no config **local** do repositório, nunca no global:
  `git config user.name "RH Albergoni" && git config user.email "314819085+rh-albergoni@users.noreply.github.com"`.
- Nenhuma outra identidade: nem `s2leonam@gmail.com`, `leonampuzlplace`, `Leonam Lima`,
  `Your Name`, nem o e-mail de outra conta do GitHub.
- Nunca adicione Claude como autor, coautor ou contributor: sem `Co-Authored-By`, sem
  "Generated with Claude Code" em commit, PR, issue ou descrição.
