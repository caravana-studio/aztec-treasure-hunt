use dep::aztec::{
    protocol::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

use crate::TreasureHunt;

// Setup function for treasure hunt contract tests
// Returns: (TestEnvironment, contract_address, admin_address)
pub unconstrained fn setup() -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let admin = env.create_light_account();

    let initializer_call_interface = TreasureHunt::interface().constructor(admin);
    let contract_address =
        env.deploy("TreasureHunt").with_public_initializer(admin, initializer_call_interface);

    (env, contract_address, admin)
}
