{
  description = "Server shell";
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    # systems.url = "github:nix-systems/default";
  };
  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      devShells.${system} = {
        default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodePackages.pnpm
          ];
          packages = [
            pkgs.bashInteractive
          ];
        };
      };

      # packages.${system}.hello = pkgs.hello;
      # packages.${system}.default = self.packages.${system}.hello;
    };
}
