"""Read secret from python"""
from argparse import ArgumentParser
import hvac
import urllib3
urllib3.disable_warnings()


class VaultAccessor:
    """Methods for accessing Vault"""

    def __init__(self, secrets_path, address, token):
        self.client = hvac.Client(url=address, token=token, verify=False)
        self.path = secrets_path

    def read_secret(self, secret, key):
        """Read vault secret"""
        path = "secret/data/{}/{}".format(self.path, secret)
        secret = self.client.read(path)
        if not secret:
            raise VaultAccessError("Could not read secret from path {}".format(path))
        if not secret["data"]["data"].get(key):
            raise VaultAccessError("Could not read key {} from secret {}".format(key, path))
        print(secret["data"]["data"][key])


class VaultAccessError(Exception):
    """Exception during access to Vault"""

def main():
    """Main method"""
    parser = ArgumentParser()
    parser.add_argument("secrets_path", help="The path to the secrets")
    parser.add_argument("vault_address", help="The address of the vault")
    parser.add_argument("token", help="A vault access token")
    parser.add_argument("secret", help="The secret to extract")
    parser.add_argument("key", help="The key to extract from the secret")
    args = parser.parse_args()
    accessor = VaultAccessor(args.secrets_path, args.vault_address, args.token)
    accessor.read_secret(args.secret, args.key)


if __name__ == "__main__":
    main()