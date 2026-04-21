const WikiArtistProfiles = (() => {
  function normalizar(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function spotifySearch(nome) {
    return `https://open.spotify.com/search/${encodeURIComponent(nome)}`;
  }

  const profiles = [
    {
      artist: "Pink Floyd",
      albums: [
        {
          match: ["wish you were here"],
          title: "Participantes em Wish You Were Here",
          members: [
            {
              name: "David Gilmour",
              role: "Guitarra, vocais",
              bio: "Voz e guitarra centrais na fase clássica da banda.",
              spotifyUrl: "https://open.spotify.com/artist/2FcC4sDMXme2ziI7tGKMK8"
            },
            {
              name: "Roger Waters",
              role: "Baixo, vocais, conceito",
              bio: "Principal força conceitual e letrista no período.",
              spotifyUrl: "https://open.spotify.com/artist/40DqL6Tv84cKT2pH2NMs9r"
            },
            {
              name: "Richard Wright",
              role: "Teclados, vocais",
              bio: "Responsável por boa parte da atmosfera harmônica do Pink Floyd.",
              spotifyUrl: spotifySearch("Richard Wright Pink Floyd")
            },
            {
              name: "Nick Mason",
              role: "Bateria, percussão",
              bio: "Baterista fundador e presença constante na discografia da banda.",
              spotifyUrl: spotifySearch("Nick Mason")
            }
          ]
        }
      ],
      members: [
        {
          name: "David Gilmour",
          role: "Guitarra, vocais",
          bio: "Guitarrista e vocalista associado à fase clássica da banda.",
          spotifyUrl: "https://open.spotify.com/artist/2FcC4sDMXme2ziI7tGKMK8"
        },
        {
          name: "Roger Waters",
          role: "Baixo, vocais",
          bio: "Baixista, vocalista e compositor ligado aos conceitos dos grandes álbuns.",
          spotifyUrl: "https://open.spotify.com/artist/40DqL6Tv84cKT2pH2NMs9r"
        },
        {
          name: "Richard Wright",
          role: "Teclados",
          bio: "Tecladista fundador e peça-chave no som atmosférico do grupo.",
          spotifyUrl: spotifySearch("Richard Wright Pink Floyd")
        },
        {
          name: "Nick Mason",
          role: "Bateria",
          bio: "Baterista fundador e único membro presente em todos os álbuns da banda.",
          spotifyUrl: spotifySearch("Nick Mason")
        },
        {
          name: "Syd Barrett",
          role: "Guitarra, vocais",
          bio: "Fundador e força criativa dos primeiros anos psicodélicos.",
          spotifyUrl: "https://open.spotify.com/artist/6Lt3HS8R2v8Q4G7ZkUWa8R"
        }
      ]
    },
    {
      artist: "Metallica",
      members: [
        {
          name: "James Hetfield",
          role: "Vocais, guitarra base",
          bio: "Vocalista, guitarrista e cofundador do Metallica.",
          spotifyUrl: spotifySearch("James Hetfield")
        },
        {
          name: "Lars Ulrich",
          role: "Bateria",
          bio: "Baterista, cofundador e uma das forças organizadoras da banda.",
          spotifyUrl: spotifySearch("Lars Ulrich")
        },
        {
          name: "Kirk Hammett",
          role: "Guitarra solo",
          bio: "Guitarrista solo conhecido por riffs e solos marcantes.",
          spotifyUrl: spotifySearch("Kirk Hammett")
        },
        {
          name: "Robert Trujillo",
          role: "Baixo",
          bio: "Baixista da formação moderna do Metallica.",
          spotifyUrl: spotifySearch("Robert Trujillo")
        }
      ]
    },
    {
      artist: "Nirvana",
      members: [
        {
          name: "Kurt Cobain",
          role: "Vocais, guitarra",
          bio: "Vocalista, guitarrista e principal compositor do Nirvana.",
          spotifyUrl: spotifySearch("Kurt Cobain")
        },
        {
          name: "Krist Novoselic",
          role: "Baixo",
          bio: "Baixista e cofundador da banda.",
          spotifyUrl: spotifySearch("Krist Novoselic")
        },
        {
          name: "Dave Grohl",
          role: "Bateria",
          bio: "Baterista na fase mais conhecida do Nirvana.",
          spotifyUrl: spotifySearch("Dave Grohl")
        }
      ]
    },
    {
      artist: "Queen",
      members: [
        {
          name: "Freddie Mercury",
          role: "Vocais, piano",
          bio: "Vocalista e uma das presenças mais icônicas do rock.",
          spotifyUrl: spotifySearch("Freddie Mercury")
        },
        {
          name: "Brian May",
          role: "Guitarra",
          bio: "Guitarrista e compositor, conhecido pelo timbre da Red Special.",
          spotifyUrl: spotifySearch("Brian May")
        },
        {
          name: "Roger Taylor",
          role: "Bateria, vocais",
          bio: "Baterista, vocalista e compositor do Queen.",
          spotifyUrl: spotifySearch("Roger Taylor Queen")
        },
        {
          name: "John Deacon",
          role: "Baixo",
          bio: "Baixista e compositor de clássicos do Queen.",
          spotifyUrl: spotifySearch("John Deacon")
        }
      ]
    },
    {
      artist: "The Beatles",
      members: [
        {
          name: "John Lennon",
          role: "Vocais, guitarra",
          bio: "Vocalista, guitarrista e compositor fundador.",
          spotifyUrl: spotifySearch("John Lennon")
        },
        {
          name: "Paul McCartney",
          role: "Vocais, baixo",
          bio: "Baixista, vocalista e compositor central do grupo.",
          spotifyUrl: spotifySearch("Paul McCartney")
        },
        {
          name: "George Harrison",
          role: "Guitarra",
          bio: "Guitarrista e compositor, com forte identidade melódica.",
          spotifyUrl: spotifySearch("George Harrison")
        },
        {
          name: "Ringo Starr",
          role: "Bateria",
          bio: "Baterista e voz de algumas faixas clássicas.",
          spotifyUrl: spotifySearch("Ringo Starr")
        }
      ]
    },
    {
      artist: "Black Sabbath",
      members: [
        {
          name: "Ozzy Osbourne",
          role: "Vocais",
          bio: "Vocalista da formação clássica do Black Sabbath.",
          spotifyUrl: spotifySearch("Ozzy Osbourne")
        },
        {
          name: "Tony Iommi",
          role: "Guitarra",
          bio: "Guitarrista e arquiteto de muitos riffs do heavy metal.",
          spotifyUrl: spotifySearch("Tony Iommi")
        },
        {
          name: "Geezer Butler",
          role: "Baixo",
          bio: "Baixista e letrista da formação clássica.",
          spotifyUrl: spotifySearch("Geezer Butler")
        },
        {
          name: "Bill Ward",
          role: "Bateria",
          bio: "Baterista original da banda.",
          spotifyUrl: spotifySearch("Bill Ward")
        }
      ]
    }
  ];

  function encontrarPerfil(artista) {
    const nomeNormalizado = normalizar(artista);

    return profiles.find((profile) => {
      const profileNormalizado = normalizar(profile.artist);
      return nomeNormalizado === profileNormalizado || nomeNormalizado.includes(profileNormalizado);
    });
  }

  function getParticipants(album) {
    const profile = encontrarPerfil(album?.nome);

    if (!profile) {
      return null;
    }

    const albumNormalizado = normalizar(album.album);
    const albumProfile = (profile.albums || []).find((item) =>
      item.match.some((match) => albumNormalizado.includes(normalizar(match)))
    );

    if (albumProfile) {
      return {
        title: albumProfile.title,
        note: "Base local da Wikiband para este álbum.",
        members: albumProfile.members
      };
    }

    return {
      title: `Perfis relacionados a ${profile.artist}`,
      note: "Formação relacionada ao artista; em alguns álbuns a formação pode variar.",
      members: profile.members
    };
  }

  return {
    getParticipants
  };
})();

window.WikiArtistProfiles = WikiArtistProfiles;
