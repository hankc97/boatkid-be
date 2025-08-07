/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/boatkid.json`.
 */
export type Boatkid = {
  address: "DbkSY7x2S7PFRNR1XtUtJBGbo3ri3YtQ7Mj3tkGV5eSD";
  metadata: {
    name: "boatkid";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "editConfig";
      discriminator: [244, 197, 215, 48, 246, 184, 210, 138];
      accounts: [
        {
          name: "admin";
          signer: true;
        },
        {
          name: "generalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  98,
                  111,
                  97,
                  116,
                  107,
                  105,
                  100,
                  45,
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ];
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "admin";
          type: {
            option: "pubkey";
          };
        },
        {
          name: "operators";
          type: {
            option: {
              vec: "pubkey";
            };
          };
        },
        {
          name: "burnBps";
          type: {
            option: "u16";
          };
        },
        {
          name: "taxBps";
          type: {
            option: "u16";
          };
        }
      ];
    },
    {
      name: "initConfig";
      discriminator: [23, 235, 115, 232, 168, 96, 1, 231];
      accounts: [
        {
          name: "signer";
          writable: true;
          signer: true;
        },
        {
          name: "generalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  98,
                  111,
                  97,
                  116,
                  107,
                  105,
                  100,
                  45,
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ];
              }
            ];
          };
        },
        {
          name: "generalMint";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "admin";
          type: "pubkey";
        },
        {
          name: "operators";
          type: {
            vec: "pubkey";
          };
        },
        {
          name: "burnBps";
          type: "u16";
        },
        {
          name: "taxBps";
          type: "u16";
        }
      ];
    },
    {
      name: "joinGame";
      discriminator: [107, 112, 18, 38, 56, 173, 60, 128];
      accounts: [
        {
          name: "player";
          writable: true;
          signer: true;
        },
        {
          name: "game";
          writable: true;
        },
        {
          name: "operator";
          signer: true;
        },
        {
          name: "boatConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  98,
                  111,
                  97,
                  116,
                  107,
                  105,
                  100,
                  45,
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ];
              }
            ];
          };
        },
        {
          name: "gameAta";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "game";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ];
            };
          };
        },
        {
          name: "gameBet";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 116, 107, 105, 100];
              },
              {
                kind: "account";
                path: "game";
              },
              {
                kind: "account";
                path: "player";
              }
            ];
          };
        },
        {
          name: "mint";
          relations: ["whitelistedToken"];
        },
        {
          name: "whitelistedToken";
        },
        {
          name: "userAta";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        }
      ];
      args: [
        {
          name: "tokenAmount";
          type: "u64";
        },
        {
          name: "amountUsd";
          type: "u64";
        }
      ];
    },
    {
      name: "removeWhitelist";
      discriminator: [148, 244, 73, 234, 131, 55, 247, 90];
      accounts: [
        {
          name: "operator";
          writable: true;
          signer: true;
        },
        {
          name: "generalConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  98,
                  111,
                  97,
                  116,
                  107,
                  105,
                  100,
                  45,
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ];
              }
            ];
          };
        },
        {
          name: "whitelistedToken";
          writable: true;
        }
      ];
      args: [];
    },
    {
      name: "resolveGame";
      discriminator: [25, 119, 183, 229, 196, 69, 169, 79];
      accounts: [
        {
          name: "operator";
          signer: true;
        },
        {
          name: "generalConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  98,
                  111,
                  97,
                  116,
                  107,
                  105,
                  100,
                  45,
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ];
              }
            ];
          };
        },
        {
          name: "winner";
          writable: true;
        },
        {
          name: "generalGameBet";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 116, 107, 105, 100];
              },
              {
                kind: "account";
                path: "game";
              },
              {
                kind: "account";
                path: "winner";
              }
            ];
          };
        },
        {
          name: "game";
          writable: true;
        },
        {
          name: "mint";
        },
        {
          name: "gameAta";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "game";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ];
            };
          };
        },
        {
          name: "winnerAta";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        }
      ];
      args: [
        {
          name: "claimData";
          type: {
            vec: {
              defined: {
                name: "claimableData";
              };
            };
          };
        },
        {
          name: "winner";
          type: "pubkey";
        }
      ];
    },
    {
      name: "startGame";
      discriminator: [249, 47, 252, 172, 184, 162, 245, 14];
      accounts: [
        {
          name: "operator";
          writable: true;
          signer: true;
        },
        {
          name: "boatConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  98,
                  111,
                  97,
                  116,
                  107,
                  105,
                  100,
                  45,
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ];
              }
            ];
          };
        },
        {
          name: "boatGame";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 116, 107, 105, 100];
              },
              {
                kind: "account";
                path: "boat_config.game_nonce";
                account: "generalConfig";
              },
              {
                kind: "const";
                value: [98, 111, 97, 116, 107, 105, 100, 45, 103, 97, 109, 101];
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "maxBetSize";
          type: "u64";
        },
        {
          name: "maxAllowedParticipants";
          type: "u8";
        }
      ];
    },
    {
      name: "whitelistToken";
      discriminator: [6, 141, 83, 167, 31, 6, 2, 224];
      accounts: [
        {
          name: "operator";
          writable: true;
          signer: true;
        },
        {
          name: "generalConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  98,
                  111,
                  97,
                  116,
                  107,
                  105,
                  100,
                  45,
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ];
              }
            ];
          };
        },
        {
          name: "mint";
        },
        {
          name: "whitelistedToken";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 116, 107, 105, 100];
              },
              {
                kind: "account";
                path: "mint";
              },
              {
                kind: "const";
                value: [
                  98,
                  111,
                  97,
                  116,
                  107,
                  105,
                  100,
                  45,
                  119,
                  104,
                  105,
                  116,
                  101,
                  108,
                  105,
                  115,
                  116
                ];
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "gameBet";
      discriminator: [100, 52, 237, 191, 229, 2, 41, 63];
    },
    {
      name: "generalConfig";
      discriminator: [27, 195, 209, 109, 238, 85, 254, 181];
    },
    {
      name: "generalGame";
      discriminator: [108, 177, 25, 37, 148, 77, 48, 124];
    },
    {
      name: "whitelistedToken";
      discriminator: [217, 124, 32, 114, 40, 167, 143, 233];
    }
  ];
  events: [
    {
      name: "gameBetResolved";
      discriminator: [89, 96, 171, 151, 105, 198, 51, 29];
    },
    {
      name: "gameCreated";
      discriminator: [218, 25, 150, 94, 177, 112, 96, 2];
    },
    {
      name: "joinedGame";
      discriminator: [116, 197, 87, 131, 12, 175, 49, 236];
    },
    {
      name: "tokenWhitelisted";
      discriminator: [65, 3, 231, 165, 235, 116, 154, 51];
    },
    {
      name: "whitelistRemoved";
      discriminator: [57, 55, 186, 142, 33, 197, 220, 71];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "invalidAdmin";
      msg: "Invalid admin";
    },
    {
      code: 6001;
      name: "invalidOperator";
      msg: "Invalid operator";
    },
    {
      code: 6002;
      name: "maxOperatorsExceeded";
      msg: "Max allowed operators is 5";
    },
    {
      code: 6003;
      name: "tokenNotWhitelisted";
      msg: "Toke not whitelisted";
    },
    {
      code: 6004;
      name: "gameParticipantsCapReached";
      msg: "Game participants cap reached";
    },
    {
      code: 6005;
      name: "claimDataMaxLenReached";
      msg: "Max len of claim data is 10";
    },
    {
      code: 6006;
      name: "invalidUser";
      msg: "Invalid user";
    },
    {
      code: 6007;
      name: "bettingClosed";
      msg: "Betting closed";
    },
    {
      code: 6008;
      name: "invalidWinner";
      msg: "Invalid winner";
    },
    {
      code: 6009;
      name: "gameAlreadyResolved";
      msg: "Game already resolved";
    }
  ];
  types: [
    {
      name: "claimableData";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "user";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "gameBet";
      type: {
        kind: "struct";
        fields: [
          {
            name: "game";
            type: "pubkey";
          },
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "token";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "betAt";
            type: "i64";
          },
          {
            name: "reserved";
            type: {
              array: ["u8", 64];
            };
          }
        ];
      };
    },
    {
      name: "gameBetResolved";
      type: {
        kind: "struct";
        fields: [
          {
            name: "gameBet";
            type: "pubkey";
          },
          {
            name: "claimable";
            type: {
              vec: {
                defined: {
                  name: "claimableData";
                };
              };
            };
          },
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "resolvedAt";
            type: "i64";
          },
          {
            name: "winner";
            type: "pubkey";
          },
          {
            name: "totalPayout";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "gameCreated";
      type: {
        kind: "struct";
        fields: [
          {
            name: "game";
            type: "pubkey";
          },
          {
            name: "maxParticipants";
            type: "u8";
          },
          {
            name: "maxBetSize";
            type: "u64";
          },
          {
            name: "createdAt";
            type: "i64";
          }
        ];
      };
    },
    {
      name: "gameStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "initialized";
          },
          {
            name: "started";
          },
          {
            name: "resolved";
          }
        ];
      };
    },
    {
      name: "generalConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "gameNonce";
            type: "u64";
          },
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "operators";
            type: {
              vec: "pubkey";
            };
          },
          {
            name: "generalMint";
            type: "pubkey";
          },
          {
            name: "burnBps";
            type: "u16";
          },
          {
            name: "taxBps";
            type: "u16";
          }
        ];
      };
    },
    {
      name: "generalGame";
      type: {
        kind: "struct";
        fields: [
          {
            name: "nonce";
            type: "u64";
          },
          {
            name: "totalBetAmount";
            type: "u64";
          },
          {
            name: "createdAt";
            type: "i64";
          },
          {
            name: "maxAllowedParticipants";
            type: "u8";
          },
          {
            name: "status";
            type: {
              defined: {
                name: "gameStatus";
              };
            };
          },
          {
            name: "joinedParticipants";
            type: "u8";
          },
          {
            name: "maxBetSize";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "reserved";
            type: {
              array: ["u8", 32];
            };
          }
        ];
      };
    },
    {
      name: "joinedGame";
      type: {
        kind: "struct";
        fields: [
          {
            name: "game";
            type: "pubkey";
          },
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "tokenBetAmount";
            type: "u64";
          },
          {
            name: "usdAmount";
            type: "u64";
          },
          {
            name: "joinedAt";
            type: "i64";
          }
        ];
      };
    },
    {
      name: "tokenWhitelisted";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "operator";
            type: "pubkey";
          },
          {
            name: "whitelistedAt";
            type: "i64";
          }
        ];
      };
    },
    {
      name: "whitelistRemoved";
      type: {
        kind: "struct";
        fields: [
          {
            name: "whitelistData";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "removedBy";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "whitelistedToken";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "whitelistedBy";
            type: "pubkey";
          },
          {
            name: "whitelistedAt";
            type: "i64";
          },
          {
            name: "isWhitelisted";
            type: "bool";
          }
        ];
      };
    }
  ];
};
