// Shared bits for social pages: person cards and the follow button.
(function initWikibandPeople(window, document) {
  const Storage = window.WikibandStorage;

  function initials(name) {
    return (
      String(name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "?"
    );
  }

  function profileUrl(username) {
    return `/usuario.html?u=${encodeURIComponent(username)}`;
  }

  function personCard(person, { action } = {}) {
    const card = document.createElement("article");
    card.className = "person-card";

    const link = document.createElement("a");
    link.className = "person-link";
    link.href = profileUrl(person.username);

    const avatar = document.createElement("span");
    avatar.className = "profile-avatar";
    avatar.textContent = initials(person.nome);

    const text = document.createElement("span");
    text.className = "person-text";
    const name = document.createElement("strong");
    name.textContent = person.nome;
    const handle = document.createElement("span");
    handle.textContent = `@${person.username}`;
    text.append(name, handle);

    link.append(avatar, text);
    card.appendChild(link);
    if (action) card.appendChild(action);
    return card;
  }

  function peopleList(people, emptyText) {
    const list = document.createElement("div");
    list.className = "people-list";

    if (!people.length) {
      const empty = document.createElement("p");
      empty.className = "vazio";
      empty.textContent = emptyText;
      list.appendChild(empty);
      return list;
    }

    list.append(...people.map((person) => personCard(person)));
    return list;
  }

  // onChange receives the server response ({ voceSegue, seguidores, seguindo }).
  function followButton(username, following, onChange) {
    const button = document.createElement("button");
    button.type = "button";

    const paint = (isFollowing) => {
      button.className = isFollowing ? "secondary-btn follow-btn is-following" : "primary-btn follow-btn";
      button.textContent = isFollowing ? "Seguindo" : "Seguir";
      button.setAttribute("aria-pressed", String(isFollowing));
      button.dataset.following = String(isFollowing);
    };

    paint(following);

    button.addEventListener("click", async () => {
      if (!Storage.getCurrentSession()) {
        window.location.href = `/login.html`;
        return;
      }

      const next = button.dataset.following !== "true";
      button.disabled = true;
      const result = await Storage.setFollow(username, next);
      button.disabled = false;

      if (!result.ok) {
        window.WikibandUI?.toast(result.message || "Não foi possível atualizar agora.");
        return;
      }

      paint(result.voceSegue);
      onChange?.(result);
    });

    return button;
  }

  window.WikibandPeople = { followButton, initials, peopleList, personCard, profileUrl };
})(window, document);
