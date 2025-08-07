export const idl = {
  address: "DbkSY7x2S7PFRNR1XtUtJBGbo3ri3YtQ7Mj3tkGV5eSD",
  metadata: {
    name: "boatkid",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Created with Anchor",
  },
  instructions: [
    {
      name: "edit_config",
      discriminator: [244, 197, 215, 48, 246, 184, 210, 138],
      accounts: [
        {
          name: "admin",
          signer: true,
        },
        {
          name: "general_config",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  98, 111, 97, 116, 107, 105, 100, 45, 103, 108, 111, 98, 97,
                  108,
                ],
              },
            ],
          },
        },
      ],
      args: [
        {
          name: "admin",
          type: {
            option: "pubkey",
          },
        },
        {
          name: "operators",
          type: {
            option: {
              vec: "pubkey",
            },
          },
        },
        {
          name: "burn_bps",
          type: {
            option: "u16",
          },
        },
        {
          name: "tax_bps",
          type: {
            option: "u16",
          },
        },
      ],
    },
    {
      name: "init_config",
      discriminator: [23, 235, 115, 232, 168, 96, 1, 231],
      accounts: [
        {
          name: "signer",
          writable: true,
          signer: true,
        },
        {
          name: "general_config",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  98, 111, 97, 116, 107, 105, 100, 45, 103, 108, 111, 98, 97,
                  108,
                ],
              },
            ],
          },
        },
        {
          name: "general_mint",
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111",
        },
      ],
      args: [
        {
          name: "admin",
          type: "pubkey",
        },
        {
          name: "operators",
          type: {
            vec: "pubkey",
          },
        },
        {
          name: "burn_bps",
          type: "u16",
        },
        {
          name: "tax_bps",
          type: "u16",
        },
      ],
    },
    {
      name: "join_game",
      discriminator: [107, 112, 18, 38, 56, 173, 60, 128],
      accounts: [
        {
          name: "player",
          writable: true,
          signer: true,
        },
        {
          name: "game",
          writable: true,
        },
        {
          name: "operator",
          signer: true,
        },
        {
          name: "boat_config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  98, 111, 97, 116, 107, 105, 100, 45, 103, 108, 111, 98, 97,
                  108,
                ],
              },
            ],
          },
        },
        {
          name: "game_ata",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "game",
              },
              {
                kind: "account",
                path: "token_program",
              },
              {
                kind: "account",
                path: "mint",
              },
            ],
            program: {
              kind: "const",
              value: [
                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142,
                13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216,
                219, 233, 248, 89,
              ],
            },
          },
        },
        {
          name: "game_bet",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [98, 111, 97, 116, 107, 105, 100],
              },
              {
                kind: "account",
                path: "game",
              },
              {
                kind: "account",
                path: "player",
              },
            ],
          },
        },
        {
          name: "mint",
          relations: ["whitelisted_token"],
        },
        {
          name: "whitelisted_token",
        },
        {
          name: "user_ata",
          writable: true,
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111",
        },
        {
          name: "token_program",
        },
        {
          name: "associated_token_program",
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        },
      ],
      args: [
        {
          name: "token_amount",
          type: "u64",
        },
        {
          name: "amount_usd",
          type: "u64",
        },
      ],
    },
    {
      name: "remove_whitelist",
      discriminator: [148, 244, 73, 234, 131, 55, 247, 90],
      accounts: [
        {
          name: "operator",
          writable: true,
          signer: true,
        },
        {
          name: "general_config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  98, 111, 97, 116, 107, 105, 100, 45, 103, 108, 111, 98, 97,
                  108,
                ],
              },
            ],
          },
        },
        {
          name: "whitelisted_token",
          writable: true,
        },
      ],
      args: [],
    },
    {
      name: "resolve_game",
      discriminator: [25, 119, 183, 229, 196, 69, 169, 79],
      accounts: [
        {
          name: "operator",
          signer: true,
        },
        {
          name: "general_config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  98, 111, 97, 116, 107, 105, 100, 45, 103, 108, 111, 98, 97,
                  108,
                ],
              },
            ],
          },
        },
        {
          name: "winner",
          writable: true,
        },
        {
          name: "general_game_bet",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [98, 111, 97, 116, 107, 105, 100],
              },
              {
                kind: "account",
                path: "game",
              },
              {
                kind: "account",
                path: "winner",
              },
            ],
          },
        },
        {
          name: "game",
          writable: true,
        },
        {
          name: "mint",
        },
        {
          name: "game_ata",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "game",
              },
              {
                kind: "account",
                path: "token_program",
              },
              {
                kind: "account",
                path: "mint",
              },
            ],
            program: {
              kind: "const",
              value: [
                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142,
                13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216,
                219, 233, 248, 89,
              ],
            },
          },
        },
        {
          name: "winner_ata",
          writable: true,
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111",
        },
        {
          name: "token_program",
        },
        {
          name: "associated_token_program",
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        },
      ],
      args: [
        {
          name: "claim_data",
          type: {
            vec: {
              defined: {
                name: "ClaimableData",
              },
            },
          },
        },
        {
          name: "winner",
          type: "pubkey",
        },
      ],
    },
    {
      name: "start_game",
      discriminator: [249, 47, 252, 172, 184, 162, 245, 14],
      accounts: [
        {
          name: "operator",
          writable: true,
          signer: true,
        },
        {
          name: "boat_config",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  98, 111, 97, 116, 107, 105, 100, 45, 103, 108, 111, 98, 97,
                  108,
                ],
              },
            ],
          },
        },
        {
          name: "boat_game",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [98, 111, 97, 116, 107, 105, 100],
              },
              {
                kind: "account",
                path: "boat_config.game_nonce",
                account: "GeneralConfig",
              },
              {
                kind: "const",
                value: [98, 111, 97, 116, 107, 105, 100, 45, 103, 97, 109, 101],
              },
            ],
          },
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111",
        },
      ],
      args: [
        {
          name: "max_bet_size",
          type: "u64",
        },
        {
          name: "max_allowed_participants",
          type: "u8",
        },
      ],
    },
    {
      name: "whitelist_token",
      discriminator: [6, 141, 83, 167, 31, 6, 2, 224],
      accounts: [
        {
          name: "operator",
          writable: true,
          signer: true,
        },
        {
          name: "general_config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  98, 111, 97, 116, 107, 105, 100, 45, 103, 108, 111, 98, 97,
                  108,
                ],
              },
            ],
          },
        },
        {
          name: "mint",
        },
        {
          name: "whitelisted_token",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [98, 111, 97, 116, 107, 105, 100],
              },
              {
                kind: "account",
                path: "mint",
              },
              {
                kind: "const",
                value: [
                  98, 111, 97, 116, 107, 105, 100, 45, 119, 104, 105, 116, 101,
                  108, 105, 115, 116,
                ],
              },
            ],
          },
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111",
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "GameBet",
      discriminator: [100, 52, 237, 191, 229, 2, 41, 63],
    },
    {
      name: "GeneralConfig",
      discriminator: [27, 195, 209, 109, 238, 85, 254, 181],
    },
    {
      name: "GeneralGame",
      discriminator: [108, 177, 25, 37, 148, 77, 48, 124],
    },
    {
      name: "WhitelistedToken",
      discriminator: [217, 124, 32, 114, 40, 167, 143, 233],
    },
  ],
  events: [
    {
      name: "GameBetResolved",
      discriminator: [89, 96, 171, 151, 105, 198, 51, 29],
    },
    {
      name: "GameCreated",
      discriminator: [218, 25, 150, 94, 177, 112, 96, 2],
    },
    {
      name: "JoinedGame",
      discriminator: [116, 197, 87, 131, 12, 175, 49, 236],
    },
    {
      name: "TokenWhitelisted",
      discriminator: [65, 3, 231, 165, 235, 116, 154, 51],
    },
    {
      name: "WhitelistRemoved",
      discriminator: [57, 55, 186, 142, 33, 197, 220, 71],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InvalidAdmin",
      msg: "Invalid admin",
    },
    {
      code: 6001,
      name: "InvalidOperator",
      msg: "Invalid operator",
    },
    {
      code: 6002,
      name: "MaxOperatorsExceeded",
      msg: "Max allowed operators is 5",
    },
    {
      code: 6003,
      name: "TokenNotWhitelisted",
      msg: "Toke not whitelisted",
    },
    {
      code: 6004,
      name: "GameParticipantsCapReached",
      msg: "Game participants cap reached",
    },
    {
      code: 6005,
      name: "ClaimDataMaxLenReached",
      msg: "Max len of claim data is 10",
    },
    {
      code: 6006,
      name: "InvalidUser",
      msg: "Invalid user",
    },
    {
      code: 6007,
      name: "BettingClosed",
      msg: "Betting closed",
    },
    {
      code: 6008,
      name: "InvalidWinner",
      msg: "Invalid winner",
    },
    {
      code: 6009,
      name: "GameAlreadyResolved",
      msg: "Game already resolved",
    },
  ],
  types: [
    {
      name: "ClaimableData",
      type: {
        kind: "struct",
        fields: [
          {
            name: "mint",
            type: "pubkey",
          },
          {
            name: "amount",
            type: "u64",
          },
          {
            name: "user",
            type: "pubkey",
          },
        ],
      },
    },
    {
      name: "GameBet",
      type: {
        kind: "struct",
        fields: [
          {
            name: "game",
            type: "pubkey",
          },
          {
            name: "user",
            type: "pubkey",
          },
          {
            name: "token",
            type: "pubkey",
          },
          {
            name: "amount",
            type: "u64",
          },
          {
            name: "bet_at",
            type: "i64",
          },
          {
            name: "reserved",
            type: {
              array: ["u8", 64],
            },
          },
        ],
      },
    },
    {
      name: "GameBetResolved",
      type: {
        kind: "struct",
        fields: [
          {
            name: "game_bet",
            type: "pubkey",
          },
          {
            name: "claimable",
            type: {
              vec: {
                defined: {
                  name: "ClaimableData",
                },
              },
            },
          },
          {
            name: "user",
            type: "pubkey",
          },
          {
            name: "resolved_at",
            type: "i64",
          },
          {
            name: "winner",
            type: "pubkey",
          },
          {
            name: "total_payout",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "GameCreated",
      type: {
        kind: "struct",
        fields: [
          {
            name: "game",
            type: "pubkey",
          },
          {
            name: "max_participants",
            type: "u8",
          },
          {
            name: "max_bet_size",
            type: "u64",
          },
          {
            name: "created_at",
            type: "i64",
          },
        ],
      },
    },
    {
      name: "GameStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Initialized",
          },
          {
            name: "Started",
          },
          {
            name: "Resolved",
          },
        ],
      },
    },
    {
      name: "GeneralConfig",
      type: {
        kind: "struct",
        fields: [
          {
            name: "game_nonce",
            type: "u64",
          },
          {
            name: "admin",
            type: "pubkey",
          },
          {
            name: "operators",
            type: {
              vec: "pubkey",
            },
          },
          {
            name: "general_mint",
            type: "pubkey",
          },
          {
            name: "burn_bps",
            type: "u16",
          },
          {
            name: "tax_bps",
            type: "u16",
          },
        ],
      },
    },
    {
      name: "GeneralGame",
      type: {
        kind: "struct",
        fields: [
          {
            name: "nonce",
            type: "u64",
          },
          {
            name: "total_bet_amount",
            type: "u64",
          },
          {
            name: "created_at",
            type: "i64",
          },
          {
            name: "max_allowed_participants",
            type: "u8",
          },
          {
            name: "status",
            type: {
              defined: {
                name: "GameStatus",
              },
            },
          },
          {
            name: "joined_participants",
            type: "u8",
          },
          {
            name: "max_bet_size",
            type: "u64",
          },
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "reserved",
            type: {
              array: ["u8", 32],
            },
          },
        ],
      },
    },
    {
      name: "JoinedGame",
      type: {
        kind: "struct",
        fields: [
          {
            name: "game",
            type: "pubkey",
          },
          {
            name: "user",
            type: "pubkey",
          },
          {
            name: "mint",
            type: "pubkey",
          },
          {
            name: "token_bet_amount",
            type: "u64",
          },
          {
            name: "usd_amount",
            type: "u64",
          },
          {
            name: "joined_at",
            type: "i64",
          },
        ],
      },
    },
    {
      name: "TokenWhitelisted",
      type: {
        kind: "struct",
        fields: [
          {
            name: "mint",
            type: "pubkey",
          },
          {
            name: "operator",
            type: "pubkey",
          },
          {
            name: "whitelisted_at",
            type: "i64",
          },
        ],
      },
    },
    {
      name: "WhitelistRemoved",
      type: {
        kind: "struct",
        fields: [
          {
            name: "whitelist_data",
            type: "pubkey",
          },
          {
            name: "mint",
            type: "pubkey",
          },
          {
            name: "removed_by",
            type: "pubkey",
          },
        ],
      },
    },
    {
      name: "WhitelistedToken",
      type: {
        kind: "struct",
        fields: [
          {
            name: "mint",
            type: "pubkey",
          },
          {
            name: "whitelisted_by",
            type: "pubkey",
          },
          {
            name: "whitelisted_at",
            type: "i64",
          },
          {
            name: "is_whitelisted",
            type: "bool",
          },
        ],
      },
    },
  ],
};
