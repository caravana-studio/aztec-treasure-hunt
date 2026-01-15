use dep::aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};
use crate::TreasureHunt;

// Test constants
pub global TEST_GAME_ID_1: Field = 1;
pub global TEST_GAME_ID_2: Field = 2;
pub global TEST_GAME_ID_3: Field = 3;
pub global TEST_GAME_ID_4: Field = 4;
pub global TEST_GAME_ID_5: Field = 5;

// Sample treasure positions for testing
pub unconstrained fn sample_treasures_player1() -> (u8, u8, u8, u8, u8, u8) {
    // Player 1 places at corners: (0,0), (7,7), (0,7)
    (0, 0, 7, 7, 0, 7)
}

pub unconstrained fn sample_treasures_player2() -> (u8, u8, u8, u8, u8, u8) {
    // Player 2 places in middle area: (3,3), (4,4), (5,5)
    (3, 3, 4, 4, 5, 5)
}

// Helper to setup a game with two players
pub unconstrained fn setup_two_player_game(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player1: AztecAddress,
    player2: AztecAddress,
    game_id: Field
) {
    env.call_public(player1, TreasureHunt::at(contract_address).create_game(game_id));
    env.call_public(player2, TreasureHunt::at(contract_address).join_game(game_id));
}

// Helper to place treasures for a player
pub unconstrained fn place_player_treasures(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player: AztecAddress,
    game_id: Field,
    positions: (u8, u8, u8, u8, u8, u8)
) {
    let (x1, y1, x2, y2, x3, y3) = positions;
    env.call_private(
        player,
        TreasureHunt::at(contract_address).place_treasures(game_id, x1, y1, x2, y2, x3, y3)
    );
}

// Helper to setup a complete game ready to play
pub unconstrained fn setup_complete_game(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player1: AztecAddress,
    player2: AztecAddress,
    game_id: Field
) {
    // Create and join game
    setup_two_player_game(env, contract_address, player1, player2, game_id);

    // Place treasures for both players
    place_player_treasures(env, contract_address, player1, game_id, sample_treasures_player1());
    place_player_treasures(env, contract_address, player2, game_id, sample_treasures_player2());
}
